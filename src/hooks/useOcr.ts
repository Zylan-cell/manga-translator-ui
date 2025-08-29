import { useCallback } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import {
  DetectedTextItem,
  LoadingState,
  RecognizeBatchResponse,
} from "../types";

type SetLoading = (updater: (prev: LoadingState) => LoadingState) => void;
type SetItems = (
  updater: (prev: DetectedTextItem[] | null) => DetectedTextItem[] | null
) => void;

interface UseOcrArgs {
  imageSrc: string | null;
  detectedItems: DetectedTextItem[] | null;
  editMode: boolean;
  apiBaseUrl: string;
  setDetectedItems: SetItems;
  setIsLoading: SetLoading;
  ocrEngine: "manga";
  easyOcrLangs: string;
}

export function useOcr({
  imageSrc,
  detectedItems,
  editMode,
  apiBaseUrl,
  setDetectedItems,
  setIsLoading,
  ocrEngine,
  easyOcrLangs,
}: UseOcrArgs) {
  const recognizeAllBubbles = useCallback(async () => {
    if (!imageSrc || !detectedItems || !detectedItems.length || editMode)
      return;
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

      const data = await invoke<RecognizeBatchResponse>(
        "recognize_images_batch",
        {
          apiUrl: apiBaseUrl,
          imagesData: base64Images,
          engine: ocrEngine,
          langs: undefined, // MangaOCR doesn't use langs parameter
          autoRotate: false, // Remove auto-rotate feature
        }
      );

      if (!data?.results) throw new Error("Invalid OCR response");

      setDetectedItems((prev) =>
        (prev || []).map((item, i) => ({
          ...item,
          ocrText: data.results[i] || null,
        }))
      );
    } catch (e) {
      console.error("OCR error:", e);
      alert("OCR failed. Check API URL and logs.");
    } finally {
      setIsLoading((p) => ({ ...p, ocr: false }));
    }
  }, [
    imageSrc,
    detectedItems,
    editMode,
    apiBaseUrl,
    setDetectedItems,
    setIsLoading,
    ocrEngine,
    easyOcrLangs,
  ]);

  return { recognizeAllBubbles };
}
