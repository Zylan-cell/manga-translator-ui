// src/hooks/useProcessAll.ts
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  BoundingBox,
  DetectedTextItem,
  PanelDetectionResult,
  RecognizeBatchResponse,
  YoloDetectionResult,
  ImageInfo,
  DEFAULT_TEXT_PROPERTIES,
} from "../types";
import { ProgressState } from "../types/ui";
import { sortBubblesByPanels } from "../utils/sorting";
import { parseNumberedLinesToPairs } from "../utils/llm";
import { runInPool } from "../utils/pool";

type SetState<T> = (value: T | ((prev: T) => T)) => void;

type Args = {
  apiBaseUrl: string;
  usePanelDetection: boolean;
  translationUrl: string;
  selectedModel: string;
  systemPrompt: string;
  enableTwoStepTranslation: boolean;
  deeplxUrl: string;
  deeplxApiKey: string;
  deeplTargetLang: string;

  setDetectedItems: SetState<DetectedTextItem[] | null>;
  setImageList: SetState<ImageInfo[]>;
  setProgress: SetState<ProgressState>;

  // новый флаг — чтобы не сбивать прогресс-бар при переключении изображений
  setBatchActive: SetState<boolean>;
};

function uuid(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function extToMime(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "bmp":
      return "image/bmp";
    case "gif":
      return "image/gif";
    case "tif":
    case "tiff":
      return "image/tiff";
    case "avif":
      return "image/avif";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    default:
      return "application/octet-stream";
  }
}

async function ensureDataUrl(item: ImageInfo): Promise<string> {
  if (item.dataUrl) return item.dataUrl;

  if (item.path.startsWith("temp://")) {
    if (item.dataUrl) return item.dataUrl;
    throw new Error("No data URL available for temp image");
  }

  const b64 = await invoke<string>("read_file_b64", { path: item.path });
  const mime = extToMime(item.path);
  return `data:${mime};base64,${b64}`;
}

export function useProcessAll({
  apiBaseUrl,
  usePanelDetection,
  translationUrl,
  selectedModel,
  systemPrompt,
  enableTwoStepTranslation,
  deeplxUrl,
  deeplxApiKey,
  deeplTargetLang,
  setDetectedItems,
  setImageList,
  setProgress,
  setBatchActive,
}: Args) {
  async function detectForImage(dataUrl: string): Promise<BoundingBox[]> {
    const base64Image = dataUrl.split(",")[1];
    if (usePanelDetection) {
      const [bubbleResult, panelResult] = await Promise.all([
        invoke<YoloDetectionResult>("detect_text_areas", {
          apiUrl: apiBaseUrl,
          imageData: base64Image,
        }),
        invoke<PanelDetectionResult>("detect_panels", {
          apiUrl: apiBaseUrl,
          imageData: base64Image,
        }),
      ]);
      return sortBubblesByPanels(bubbleResult.boxes, panelResult.panels || []);
    }
    const bubbleResult = await invoke<YoloDetectionResult>(
      "detect_text_areas",
      { apiUrl: apiBaseUrl, imageData: base64Image }
    );
    return sortBubblesByPanels(bubbleResult.boxes, []);
  }

  async function cropRegion(dataUrl: string, b: BoundingBox): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const w = b.x2 - b.x1,
          h = b.y2 - b.y1;
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) return reject(new Error("2D context error"));
        ctx.drawImage(img, b.x1, b.y1, w, h, 0, 0, w, h);
        resolve(c.toDataURL("image/jpeg"));
      };
      img.onerror = () => reject(new Error("Load image error"));
      img.src = dataUrl;
    });
  }

  async function ocrForImage(dataUrl: string, boxes: BoundingBox[]) {
    const crops = await Promise.all(boxes.map((b) => cropRegion(dataUrl, b)));
    const base64Images = crops.map((d) => d.split(",")[1]);
    const data = await invoke<RecognizeBatchResponse>(
      "recognize_images_batch",
      {
        apiUrl: apiBaseUrl,
        imagesData: base64Images,
        engine: "manga",
        langs: undefined,
        autoRotate: false,
      }
    );
    return data.results || [];
  }

  async function startTranslateStreamForImage(
    path: string,
    ocrTexts: string[]
  ) {
    const numberedJP = ocrTexts
      .map((t, i) => `${i + 1}. ${t || ""}`)
      .filter((l) => /\S/.test(l))
      .join("\n");

    if (!numberedJP) return;

    const streamId = uuid();
    let buffer = "";
    let finalEnglishPairs: { id: number; translation: string }[] = [];
    let secondStepTriggered = false;

    const unlisten = await listen("llm-stream", (ev) => {
      const p = ev.payload as any;
      if (!p || p.id !== streamId) return;

      if (p.delta) {
        buffer += String(p.delta);
        const pairs = parseNumberedLinesToPairs(buffer);
        if (pairs.length) {
          finalEnglishPairs = pairs;

          setImageList((prev) =>
            prev.map((img) =>
              img.path !== path
                ? img
                : {
                    ...img,
                    items: (img.items || []).map((it) => {
                      const hit = pairs.find((x) => x.id === it.id);
                      if (hit) {
                        return {
                          ...it,
                          translation: hit.translation, // без префиксов
                          cachedIntermediateText: enableTwoStepTranslation
                            ? hit.translation
                            : it.cachedIntermediateText,
                          cachedIntermediateLang: enableTwoStepTranslation
                            ? "EN"
                            : it.cachedIntermediateLang,
                        };
                      }
                      return it;
                    }),
                  }
            )
          );
        }
      }

      if (p.done) {
        unlisten();

        if (enableTwoStepTranslation && finalEnglishPairs.length) {
          if (!secondStepTriggered) {
            secondStepTriggered = true;
            setTimeout(() => {
              performSecondStepTranslationForImage(path, finalEnglishPairs);
            }, 300);
          }
        }

        setProgress((pr) => ({ ...pr }));
      }
    });

    const performSecondStepTranslationForImage = async (
      imagePath: string,
      englishPairs: { id: number; translation: string }[]
    ) => {
      try {
        const textsEN = englishPairs.map((p) => p.translation);

        const resp2 = await invoke<any>("translate_deeplx", {
          apiUrl: deeplxUrl,
          apiKey: deeplxApiKey,
          texts: textsEN,
          targetLang: deeplTargetLang || "RU",
          sourceLang: "EN",
        });

        if (resp2.code !== 200 || !resp2.data) {
          throw new Error(
            `DeepLx failed in post-streaming mode: code ${resp2.code}, data: ${resp2.data}`
          );
        }

        const ruLines = resp2.data.split("\n");
        const finalResults = new Map<number, string>();
        englishPairs.forEach((p, idx) => finalResults.set(p.id, ruLines[idx]));

        setImageList((prev) =>
          prev.map((img) =>
            img.path !== imagePath
              ? img
              : {
                  ...img,
                  items: (img.items || []).map((it) => {
                    const englishText = englishPairs.find(
                      (p) => p.id === it.id
                    )?.translation;
                    return {
                      ...it,
                      translation: finalResults.get(it.id) ?? null,
                      cachedIntermediateText:
                        englishText || it.cachedIntermediateText,
                      cachedIntermediateLang: englishText
                        ? "EN"
                        : it.cachedIntermediateLang,
                    };
                  }),
                }
          )
        );
      } catch (e: any) {
        console.error(
          "Second step translation failed in post-streaming mode:",
          e
        );
        alert(`Second step translation failed: ${e.message}`);
        // Оставляем английский при ошибке
      }
    };

    const apiUrl = `${translationUrl.replace(/\/$/, "")}/v1/chat/completions`;
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
  }

  async function processCurrentAll(
    imageSrc: string | null,
    current?: ImageInfo
  ) {
    if (!imageSrc || !current) return;
    setBatchActive(true);
    try {
      setProgress({ active: true, current: 0, total: 3, label: "Detecting" });

      const boxes = await detectForImage(imageSrc);
      const items: DetectedTextItem[] = boxes.map((box, i) => ({
        id: i + 1,
        box,
        ocrText: null,
        translation: null,
        cachedIntermediateText: null,
        cachedIntermediateLang: null,
        textProperties: DEFAULT_TEXT_PROPERTIES,
      }));
      setDetectedItems(items);
      setImageList((prev) =>
        prev.map((im) => (im.path === current.path ? { ...im, items } : im))
      );

      setProgress({ active: true, current: 1, total: 3, label: "OCR" });

      const ocrTexts = await ocrForImage(imageSrc, boxes);
      const withOcr = items.map((it, i) => ({
        ...it,
        ocrText: ocrTexts[i] || null,
      }));
      setDetectedItems(withOcr);
      setImageList((prev) =>
        prev.map((im) =>
          im.path === current.path ? { ...im, items: withOcr } : im
        )
      );

      setProgress({ active: true, current: 2, total: 3, label: "Translating" });

      await startTranslateStreamForImage(current.path, ocrTexts);

      setProgress({ active: true, current: 3, total: 3, label: "Done" });
    } catch (e: any) {
      console.error(e);
      alert(`Process failed: ${e?.message || e}`);
    } finally {
      setTimeout(
        () => setProgress({ active: false, current: 0, total: 0, label: "" }),
        300
      );
      setBatchActive(false);
    }
  }

  async function processAllImagesAll(imageList: ImageInfo[]) {
    if (!imageList.length) return;
    setBatchActive(true);

    const total = imageList.length * 3;
    let done = 0;
    setProgress({ active: true, current: 0, total, label: "Detecting" });

    const CONC = 1; // последовательная обработка

    const results = await runInPool(imageList, CONC, async (img) => {
      const dataUrl = await ensureDataUrl(img);

      const boxes = await detectForImage(dataUrl);
      const items: DetectedTextItem[] = boxes.map((box, i) => ({
        id: i + 1,
        box,
        ocrText: null,
        translation: null,
        cachedIntermediateText: null,
        cachedIntermediateLang: null,
        textProperties: DEFAULT_TEXT_PROPERTIES,
      }));

      setImageList((prev) =>
        prev.map((im) => (im.path === img.path ? { ...im, items } : im))
      );
      setProgress({
        active: true,
        current: ++done,
        total,
        label: "OCR",
      });

      const ocrTexts = await ocrForImage(dataUrl, boxes);
      const withOcr = items.map((it, i) => ({
        ...it,
        ocrText: ocrTexts[i] || null,
      }));
      setImageList((prev) =>
        prev.map((im) =>
          im.path === img.path ? { ...im, items: withOcr } : im
        )
      );
      setProgress({
        active: true,
        current: ++done,
        total,
        label: "Translating",
      });

      return { path: img.path, ocrTexts };
    });

    await runInPool(results, CONC, async (r) => {
      await startTranslateStreamForImage(r.path, r.ocrTexts);
      setProgress({
        active: true,
        current: ++done,
        total,
        label: "Done",
      });
    });

    // Не переключаем текущую страницу автоматически

    setTimeout(
      () => setProgress({ active: false, current: 0, total: 0, label: "" }),
      500
    );
    setBatchActive(false);
  }

  return { processCurrentAll, processAllImagesAll };
}
