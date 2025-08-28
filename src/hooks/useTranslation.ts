import { useCallback } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { DeepLXResponse, DetectedTextItem, LoadingState } from "../types";

type SetLoading = (updater: (prev: LoadingState) => LoadingState) => void;
type SetItems = (
  updater: (prev: DetectedTextItem[] | null) => DetectedTextItem[] | null
) => void;

interface UseTranslationArgs {
  detectedItems: DetectedTextItem[] | null;
  editMode: boolean;
  selectedModel: string;
  translationUrl: string;
  systemPrompt: string;
  deeplOnly: boolean;
  enableTwoStepTranslation: boolean;
  deeplxUrl: string;
  deeplxApiKey: string;
  streamTranslation?: boolean;
  setDetectedItems: SetItems;
  setIsLoading: SetLoading;
  onStreamUpdate: (content: string) => void;
  onStreamEnd: () => void;
  deeplTargetLang: string; // e.g. "RU"
}

function stripCodeFences(s: string): string {
  return s
    .replace(/```json\s*([\s\S]*?)```/gi, "$1")
    .replace(/```([\s\S]*?)```/g, "$1")
    .trim();
}
function extractJsonArrayStrict(text: string): string | null {
  const src = stripCodeFences(text);
  const start = src.indexOf("[");
  if (start === -1) return null;
  let depth = 0,
    inStr = false,
    esc = false;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "[") depth++;
    if (ch === "]") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}
function tryParseJsonArray<T = any>(raw: string): T[] | null {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as T[]) : null;
  } catch {}
  const fixed = raw.replace(/,(\s*[}```])/g, "$1");
  try {
    const v = JSON.parse(fixed);
    return Array.isArray(v) ? (v as T[]) : null;
  } catch {}
  return null;
}
function parseNumberedLinesToPairs(
  raw: string
): { id: number; translation: string }[] {
  const lines = stripCodeFences(raw)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const result: { id: number; translation: string }[] = [];
  const rx = /^\s*(\d+)[\.```\:\-)]\s*(.*)$/;
  for (const line of lines) {
    const m = line.match(rx);
    if (m) {
      const id = parseInt(m[1], 10);
      const translation = m[2] ?? "";
      if (!Number.isNaN(id)) result.push({ id, translation });
    }
  }
  if (!result.length) {
    const json = extractJsonArrayStrict(raw);
    if (json) {
      const arr = tryParseJsonArray<{ id: number; translation: string }>(json);
      if (arr) {
        return arr.filter(
          (x) => typeof x?.id === "number" && typeof x?.translation === "string"
        );
      }
    }
  }
  return result;
}

async function chatCompletion(
  apiUrlBase: string,
  model: string,
  system: string,
  user: string,
  temperature = 0.2
): Promise<string> {
  const apiUrl = `${apiUrlBase.replace(/\/$/, "")}/v1/chat/completions`;
  const resp = await invoke<any>("translate_text", {
    apiUrl,
    payload: {
      model: model || "local-model",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      stream: false,
      temperature,
      max_tokens: 1500,
    },
  });
  return resp?.choices?.[0]?.message?.content || "";
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as any).randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useTranslation({
  detectedItems,
  editMode,
  selectedModel,
  translationUrl,
  systemPrompt,
  deeplOnly,
  enableTwoStepTranslation,
  deeplxUrl,
  deeplxApiKey,
  streamTranslation = false,
  setDetectedItems,
  setIsLoading,
  onStreamUpdate,
  onStreamEnd,
  deeplTargetLang,
}: UseTranslationArgs) {
  const translateAllBubbles = useCallback(async () => {
    if (!detectedItems || !detectedItems.length || editMode) return;
    const itemsToTranslate = detectedItems.filter(
      (i) => i.ocrText && i.ocrText.trim() !== ""
    );
    if (!itemsToTranslate.length) return;

    if (deeplOnly) {
      const texts = itemsToTranslate.map((i) => i.ocrText!);
      try {
        const resp = await invoke<DeepLXResponse>("translate_deeplx", {
          apiUrl: deeplxUrl,
          apiKey: deeplxApiKey,
          texts, // передаем массив
          targetLang: deeplTargetLang || "RU",
          sourceLang: null, // автоопределение
        });
        if (resp.code !== 200 || !resp.data) throw new Error("DeepLx failed");
        const lines = resp.data.split("\n");
        const map = new Map<number, string>();
        itemsToTranslate.forEach((it, idx) => {
          if (lines[idx]) map.set(it.id, lines[idx]);
        });
        setDetectedItems((prev) =>
          (prev || []).map((item) => ({
            ...item,
            translation: map.get(item.id) ?? item.translation ?? null,
          }))
        );
      } catch (e: any) {
        console.error("DeepL-only translation failed:", e);
        alert(`DeepL-only translation failed: ${e.message}`);
      } finally {
        setIsLoading((p) => ({ ...p, translate: false }));
      }
      return; // выходим, LLM не запускаем
    }

    setIsLoading((p) => ({ ...p, translate: true }));
    setDetectedItems((prev) =>
      (prev || []).map((item) => ({ ...item, translation: null }))
    );
    if (streamTranslation) onStreamUpdate("");

    try {
      const numberedJP = itemsToTranslate
        .map((i) => `${i.id}. ${i.ocrText}`)
        .join("\n");

      if (streamTranslation) {
        const streamId = uuid();
        let buffer = "";

        listen("llm-stream", async (ev) => {
          const p = ev.payload as any;
          if (!p || p.id !== streamId) return;

          if (p.delta) {
            buffer += String(p.delta);
            onStreamUpdate(buffer);
          }

          if (p.done) {
            // ЛОГИ: финальный английский
            console.log(
              "=== English (LLM stream) ===\n" +
                buffer +
                "\n============================"
            );

            const finalPairsEN = parseNumberedLinesToPairs(buffer);
            if (!finalPairsEN.length)
              throw new Error("Could not parse final streamed response.");

            let finalResults = new Map<number, string>();

            if (enableTwoStepTranslation) {
              onStreamUpdate(buffer + "\n\nTranslating via DeepLx...");
              const textsEN = finalPairsEN.map((p: any) => p.translation);
              const resp2 = await invoke<DeepLXResponse>("translate_deeplx", {
                apiUrl: deeplxUrl,
                apiKey: deeplxApiKey,
                texts: textsEN,
                targetLang: deeplTargetLang || "RU",
                sourceLang: "EN",
              });
              if (resp2.code !== 200 || !resp2.data)
                throw new Error(`Step 2 (EN->${deeplTargetLang}) failed`);
              const ruLines = resp2.data.split("\n");
              finalPairsEN.forEach((p: any, idx: number) => {
                if (ruLines[idx]) finalResults.set(p.id, ruLines[idx]);
              });
            } else {
              finalPairsEN.forEach((p: any) =>
                finalResults.set(p.id, p.translation)
              );
            }

            setDetectedItems((prev) =>
              (prev || []).map((item) => ({
                ...item,
                translation: finalResults.get(item.id) ?? null,
              }))
            );
            onStreamEnd();
            setIsLoading((p) => ({ ...p, translate: false }));
          }
        });

        const apiUrl = `${translationUrl.replace(
          /\/$/,
          ""
        )}/v1/chat/completions`;
        await invoke("translate_text_stream", {
          apiUrl,
          payload: {
            model: selectedModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: numberedJP },
            ],
            temperature: 0.2,
            stream: true,
            max_tokens: 1500,
          },
          streamId,
        });

        // отписка сделается автоматически когда p.done
        return;
      }

      // Non-stream
      const rawEN = await chatCompletion(
        translationUrl,
        selectedModel,
        systemPrompt,
        numberedJP
      );

      // ЛОГИ: английский ответ
      console.log(
        "=== English (LLM) ===\n" + rawEN + "\n====================="
      );

      const pairsEN = parseNumberedLinesToPairs(rawEN);
      if (!pairsEN.length) throw new Error("Could not parse response.");

      let finalResults = new Map<number, string>();
      if (enableTwoStepTranslation) {
        const textsEN = pairsEN.map((p) => p.translation);
        const resp2 = await invoke<DeepLXResponse>("translate_deeplx", {
          apiUrl: deeplxUrl,
          apiKey: deeplxApiKey,
          texts: textsEN,
          targetLang: deeplTargetLang || "RU",
          sourceLang: "EN",
        });
        if (resp2.code !== 200 || !resp2.data) throw new Error("DeepLx failed");
        const ruLines = resp2.data.split("\n");
        pairsEN.forEach((p, idx) => finalResults.set(p.id, ruLines[idx]));
      } else {
        pairsEN.forEach((p) => finalResults.set(p.id, p.translation));
      }

      setDetectedItems((prev) =>
        (prev || []).map((item) => ({
          ...item,
          translation: finalResults.get(item.id) ?? null,
        }))
      );
    } catch (e: any) {
      console.error("Translation failed:", e);
      alert(`Translation failed: ${e.message}`);
      onStreamEnd();
    } finally {
      if (!streamTranslation) setIsLoading((p) => ({ ...p, translate: false }));
    }
  }, [
    detectedItems,
    editMode,
    selectedModel,
    translationUrl,
    systemPrompt,
    deeplOnly,
    enableTwoStepTranslation,
    deeplxUrl,
    deeplxApiKey,
    streamTranslation,
    setDetectedItems,
    setIsLoading,
    onStreamUpdate,
    onStreamEnd,
    deeplTargetLang,
  ]);

  return { translateAllBubbles };
}
