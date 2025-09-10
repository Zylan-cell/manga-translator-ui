// src/hooks/useTranslation.ts
import { useCallback } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { DeepLXResponse, DetectedTextItem, LoadingState } from "../types";
import { parseNumberedLinesToPairs, chatCompletion } from "../utils/llm";

type SetItemsUpdater = (
  updater: (prev: DetectedTextItem[] | null) => DetectedTextItem[] | null
) => void;
type SetLoading = (updater: (prev: LoadingState) => LoadingState) => void;

interface UseTranslationArgs {
  detectedItems: DetectedTextItem[] | null;
  editMode: boolean;
  selectedModel: string;
  translationUrl: string;
  systemPrompt: string;
  enableTwoStepTranslation: boolean;
  deeplxUrl: string;
  deeplxApiKey: string;
  streamTranslation?: boolean;
  setDetectedItems: SetItemsUpdater;
  setIsLoading: SetLoading;
  onStreamUpdate: (content: string) => void;
  onStreamEnd: () => void;
  deeplTargetLang: string;
}

function uuid(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useTranslation({
  detectedItems,
  selectedModel,
  translationUrl,
  systemPrompt,
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
    if (!detectedItems || !detectedItems.length) return;
    const itemsToTranslate = detectedItems.filter(
      (i) => i.ocrText && i.ocrText.trim() !== ""
    );
    if (!itemsToTranslate.length) return;

    setIsLoading((p) => ({ ...p, translate: true }));
    // Сбрасываем предыдущий перевод
    setDetectedItems((prev) =>
      (prev || []).map((item) => ({ ...item, translation: null }))
    );

    try {
      const numberedJP = itemsToTranslate
        .map((i) => `${i.id}. ${i.ocrText}`)
        .join("\n");

      // --- ЛОГИКА ДЛЯ СТРИМИНГА ---
      if (streamTranslation) {
        const streamId = uuid();
        let buffer = "";
        let finalEnglishPairs: { id: number; translation: string }[] = [];

        // Функция для второго шага (DeepLX), будет вызвана ПОСЛЕ стрима
        const performSecondStepTranslation = async (
          englishPairs: { id: number; translation: string }[]
        ) => {
          try {
            console.log("Stream finished. Starting DeepLX translation step...");
            const textsEN = englishPairs.map((p) => p.translation);

            const resp2 = await invoke<DeepLXResponse>("translate_deeplx", {
              apiUrl: deeplxUrl,
              apiKey: deeplxApiKey,
              texts: textsEN,
              targetLang: deeplTargetLang || "RU",
              sourceLang: "EN",
            });

            if (resp2.code !== 200 || !resp2.data) {
              throw new Error(
                `DeepLx failed: code ${resp2.code}, data: ${resp2.data}`
              );
            }

            const ruLines = resp2.data.split("\n");
            const finalResults = new Map<number, string>();
            englishPairs.forEach((p, idx) =>
              finalResults.set(p.id, ruLines[idx])
            );

            // Обновляем UI финальным переводом
            setDetectedItems((prev) =>
              (prev || []).map((item) => ({
                ...item,
                translation: finalResults.get(item.id) ?? item.translation, // Используем старый (английский) если новый не пришел
              }))
            );
          } catch (e: any) {
            console.error("Second step translation failed:", e);
            alert(
              `Second step translation failed: ${e.message}. English translation will be kept.`
            );
          } finally {
            // Завершаем загрузку только после второго шага
            setIsLoading((pr) => ({ ...pr, translate: false }));
          }
        };

        const unlisten = await listen("llm-stream", (ev) => {
          const p = ev.payload as any;
          if (!p || p.id !== streamId) return;

          // ШАГ 1: Пока идет стрим (p.delta)
          if (p.delta) {
            buffer += String(p.delta);
            const pairs = parseNumberedLinesToPairs(buffer);
            if (pairs.length) {
              finalEnglishPairs = pairs; // Сохраняем последнюю валидную версию перевода

              // Обновляем UI промежуточным АНГЛИЙСКИМ переводом
              setDetectedItems((prev) =>
                (prev || []).map((item) => {
                  const hit = pairs.find((x) => x.id === item.id);
                  if (!hit) return item;
                  return {
                    ...item,
                    translation: hit.translation, // Показываем английский
                    cachedIntermediateText: enableTwoStepTranslation
                      ? hit.translation
                      : null,
                    cachedIntermediateLang: enableTwoStepTranslation
                      ? "EN"
                      : null,
                  };
                })
              );
            }
            onStreamUpdate(buffer);
          }

          // ШАГ 2: Когда стрим закончился (p.done)
          if (p.done) {
            unlisten();
            onStreamEnd();

            // Если включен 2-шаговый перевод, запускаем его
            if (enableTwoStepTranslation && finalEnglishPairs.length > 0) {
              performSecondStepTranslation(finalEnglishPairs);
            } else {
              // Если 2-шаговый перевод выключен, просто заканчиваем загрузку
              setIsLoading((pr) => ({ ...pr, translate: false }));
            }
          }
        });

        const apiUrl = `${translationUrl.replace(
          /\/$/,
          ""
        )}/v1/chat/completions`;
        await invoke("translate_text_stream", {
          apiUrl,
          payload: {
            model: selectedModel || "local-model",
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
        return;
      }

      // --- ЛОГИКА БЕЗ СТРИМИНГА (без изменений) ---
      const rawEN = await chatCompletion(
        translationUrl,
        selectedModel,
        systemPrompt,
        numberedJP
      );
      const pairsEN = parseNumberedLinesToPairs(rawEN);
      if (!pairsEN.length) throw new Error("Could not parse LLM response.");

      if (enableTwoStepTranslation) {
        const textsEN = pairsEN.map((p) => p.translation);
        const resp2 = await invoke<DeepLXResponse>("translate_deeplx", {
          apiUrl: deeplxUrl,
          apiKey: deeplxApiKey,
          texts: textsEN,
          targetLang: deeplTargetLang || "RU",
          sourceLang: "EN",
        });
        if (resp2.code !== 200 || !resp2.data)
          throw new Error(
            `DeepLx failed: code ${resp2.code}, data: ${resp2.data}`
          );

        const ruLines = resp2.data.split("\n");
        const finalResults = new Map<number, string>();
        pairsEN.forEach((p, idx) => finalResults.set(p.id, ruLines[idx]));

        setDetectedItems((prev) =>
          (prev || []).map((item) => {
            const englishText = pairsEN.find(
              (p) => p.id === item.id
            )?.translation;
            return {
              ...item,
              translation: finalResults.get(item.id) ?? null,
              cachedIntermediateText: englishText || null,
              cachedIntermediateLang: englishText ? "EN" : null,
            };
          })
        );
      } else {
        const finalResults = new Map<number, string>();
        pairsEN.forEach((p) => finalResults.set(p.id, p.translation));
        setDetectedItems((prev) =>
          (prev || []).map((item) => ({
            ...item,
            translation: finalResults.get(item.id) ?? null,
          }))
        );
      }
    } catch (e: any) {
      console.error("Translation failed:", e);
      alert(`Translation failed: ${e.message}`);
      onStreamEnd();
    } finally {
      if (!streamTranslation) setIsLoading((p) => ({ ...p, translate: false }));
    }
  }, [
    detectedItems,
    selectedModel,
    translationUrl,
    systemPrompt,
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

  const retranslateFromCache = useCallback(
    async (newTargetLang: string) => {
      if (!detectedItems || !detectedItems.length) return;
      const itemsWithCache = detectedItems.filter(
        (i) => i.cachedIntermediateText && i.cachedIntermediateLang
      );
      if (!itemsWithCache.length) return;

      setIsLoading((p) => ({ ...p, translate: true }));
      try {
        const cachedTexts = itemsWithCache.map(
          (i) => i.cachedIntermediateText!
        );
        const resp = await invoke<DeepLXResponse>("translate_deeplx", {
          apiUrl: deeplxUrl,
          apiKey: deeplxApiKey,
          texts: cachedTexts,
          targetLang: newTargetLang,
          sourceLang: itemsWithCache[0].cachedIntermediateLang!,
        });
        if (resp.code !== 200 || !resp.data)
          throw new Error(
            `DeepLx retranslation failed: code ${resp.code}, data: ${resp.data}`
          );

        const translatedLines = resp.data.split("\n");
        const translationMap = new Map<number, string>();
        itemsWithCache.forEach((item, idx) => {
          if (translatedLines[idx])
            translationMap.set(item.id, translatedLines[idx]);
        });

        setDetectedItems((prev) =>
          (prev || []).map((item) => ({
            ...item,
            translation: translationMap.get(item.id) ?? item.translation,
          }))
        );
      } catch (e: any) {
        console.error("Retranslation from cache failed:", e);
        alert(`Retranslation failed: ${e.message}`);
      } finally {
        setIsLoading((p) => ({ ...p, translate: false }));
      }
    },
    [detectedItems, deeplxUrl, deeplxApiKey, setDetectedItems, setIsLoading]
  );

  return { translateAllBubbles, retranslateFromCache };
}
