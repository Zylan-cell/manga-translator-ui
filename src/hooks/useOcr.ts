import { useCallback } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import {
  DetectedTextItem,
  LoadingState,
  RecognizeBatchResponse,
} from "../types";

type SetItemsUpdater = (
  updater: (prev: DetectedTextItem[] | null) => DetectedTextItem[] | null
) => void;
type SetLoading = (updater: (prev: LoadingState) => LoadingState) => void;

interface UseOcrArgs {
  imageSrc: string | null;
  detectedItems: DetectedTextItem[] | null;
  editMode: boolean;
  apiBaseUrl: string;
  setDetectedItems: SetItemsUpdater;
  setIsLoading: SetLoading;
  ocrEngine: "manga";
  easyOcrLangs: string;
}

export function useOcr({
  imageSrc,
  detectedItems,
  apiBaseUrl,
  setDetectedItems,
  setIsLoading,
  ocrEngine,
}: UseOcrArgs) {
  const recognizeAllBubbles = useCallback(async () => {
    if (!imageSrc || !detectedItems || !detectedItems.length) {
      console.warn("recognizeAllBubbles: Pre-conditions not met. Aborting.");
      return;
    }

    try {
      setIsLoading((p) => ({ ...p, ocr: true }));

      const cropImageRegion = async (
        imageDataUrl: string,
        box: { x1: number; y1: number; x2: number; y2: number }
      ): Promise<string> =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              reject(new Error("2D context error"));
              return;
            }
            const w = box.x2 - box.x1,
              h = box.y2 - box.y1;
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(img, box.x1, box.y1, w, h, 0, 0, w, h);
            resolve(canvas.toDataURL("image/jpeg"));
          };
          img.onerror = () => reject(new Error("Load image error"));
          img.src = imageDataUrl;
        });

      const croppedImages = await Promise.all(
        detectedItems.map((item) => cropImageRegion(imageSrc, item.box))
      );
      const base64Images = croppedImages.map((d) => d.split(",")[1]);

      // Формируем единый payload, который будет передан в Rust
      const payload = {
        images_data: base64Images,
        engine: ocrEngine,
        langs: undefined, // MangaOCR не использует этот параметр
        auto_rotate: false,
      };

      console.log(
        `Invoking tauri command: 'recognize_images_batch' with ${base64Images.length} images.`
      );

      // Передаем payload целиком
      const data = await invoke<RecognizeBatchResponse>(
        "recognize_images_batch",
        {
          apiUrl: apiBaseUrl,
          payload: payload,
        }
      );

      if (!data?.results) throw new Error("Invalid OCR response");

      setDetectedItems((prev) =>
        (prev || []).map((item, i) => ({
          ...item,
          ocrText: data.results[i] || null,
        }))
      );
      console.log("OCR successful, items updated.");
    } catch (e) {
      console.error("OCR invoke error:", e);
      alert(`OCR failed. Check console for details. Error: ${e}`);
    } finally {
      setIsLoading((p) => ({ ...p, ocr: false }));
    }
  }, [
    imageSrc,
    detectedItems,
    apiBaseUrl,
    setDetectedItems,
    setIsLoading,
    ocrEngine,
  ]);

  return { recognizeAllBubbles };
}
