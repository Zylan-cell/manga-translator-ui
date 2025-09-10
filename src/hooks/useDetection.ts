import { useCallback } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import {
  DetectedTextItem,
  LoadingState,
  PanelDetectionResult,
  YoloDetectionResult,
  BoundingBox,
  DEFAULT_TEXT_PROPERTIES,
} from "../types";
import { sortBubblesByPanels } from "../utils/sorting";

type SetItemsUpdater = (
  updater: (prev: DetectedTextItem[] | null) => DetectedTextItem[] | null
) => void;
type SetLoading = (updater: (prev: LoadingState) => LoadingState) => void;

interface UseDetectionArgs {
  imageSrc: string | null;
  apiBaseUrl: string;
  setDetectedItems: SetItemsUpdater;
  setIsLoading: SetLoading;
  usePanelDetection: boolean;
  detectionModel: string;
}

export function useDetection({
  imageSrc,
  apiBaseUrl,
  setDetectedItems,
  setIsLoading,
  usePanelDetection,
  detectionModel,
}: UseDetectionArgs) {
  const handleDetect = useCallback(async () => {
    if (!imageSrc) return;

    try {
      setIsLoading((p) => ({ ...p, detect: true }));
      const base64Image = imageSrc.split(",")[1];

      // ИЗМЕНЕНИЕ 6: Формируем единый payload
      const detectionPayload = {
        image_data: base64Image,
        detection_model: detectionModel,
      };

      let finalSortedBubbles: BoundingBox[] = [];

      if (usePanelDetection) {
        console.log(
          `Detecting with Panel Detection ENABLED and model '${detectionModel}'.`
        );
        const [bubbleResult, panelResult] = await Promise.all([
          // Передаем payload целиком
          invoke<YoloDetectionResult>("detect_text_areas", {
            apiUrl: apiBaseUrl,
            payload: detectionPayload,
          }),
          invoke<PanelDetectionResult>("detect_panels", {
            apiUrl: apiBaseUrl,
            imageData: base64Image,
          }),
        ]);
        finalSortedBubbles = sortBubblesByPanels(
          bubbleResult.boxes,
          panelResult.panels
        );
      } else {
        console.log(
          `Detecting with Panel Detection DISABLED and model '${detectionModel}'.`
        );
        // Передаем payload целиком
        const bubbleResult = await invoke<YoloDetectionResult>(
          "detect_text_areas",
          { apiUrl: apiBaseUrl, payload: detectionPayload }
        );
        finalSortedBubbles = sortBubblesByPanels(bubbleResult.boxes, []);
      }

      const items: DetectedTextItem[] = finalSortedBubbles.map(
        (box, index) => ({
          id: index + 1,
          box,
          ocrText: null,
          translation: null,
          cachedIntermediateText: null,
          cachedIntermediateLang: null,
          textProperties: DEFAULT_TEXT_PROPERTIES,
        })
      );

      setDetectedItems(() => items);
    } catch (e) {
      console.error("Detect error:", e);
      alert("Detection failed. Check API server and console for details.");
    } finally {
      setIsLoading((p) => ({ ...p, detect: false }));
    }
  }, [
    imageSrc,
    apiBaseUrl,
    usePanelDetection,
    detectionModel,
    setDetectedItems,
    setIsLoading,
  ]);

  return { handleDetect };
}
