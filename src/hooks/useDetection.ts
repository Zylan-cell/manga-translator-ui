import { useCallback } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import {
  DetectedTextItem,
  LoadingState,
  PanelDetectionResult,
  YoloDetectionResult,
  BoundingBox,
} from "../types";
import { sortBubblesByPanels } from "../utils/sorting";

type SetLoading = (updater: (prev: LoadingState) => LoadingState) => void;
type SetItems = (items: DetectedTextItem[] | null) => void;

interface UseDetectionArgs {
  imageSrc: string | null;
  editMode: boolean;
  apiBaseUrl: string;
  setDetectedItems: SetItems;
  setIsLoading: SetLoading;
  usePanelDetection: boolean;
}

export function useDetection({
  imageSrc,
  editMode,
  apiBaseUrl,
  setDetectedItems,
  setIsLoading,
  usePanelDetection,
}: UseDetectionArgs) {
  const handleDetect = useCallback(async () => {
    if (!imageSrc || editMode) return;
    try {
      setIsLoading((p) => ({ ...p, detect: true }));
      const base64Image = imageSrc.split(",")[1];

      let finalSortedBubbles: BoundingBox[] = [];

      if (usePanelDetection) {
        console.log("Detecting with Panel Detection ENABLED.");
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

        const bubbles = bubbleResult.boxes;
        const sortedPanels = panelResult.panels;
        finalSortedBubbles = sortBubblesByPanels(bubbles, sortedPanels);
      } else {
        console.log("Detecting with Panel Detection DISABLED.");
        const bubbleResult = await invoke<YoloDetectionResult>(
          "detect_text_areas",
          { apiUrl: apiBaseUrl, imageData: base64Image }
        );
        finalSortedBubbles = sortBubblesByPanels(bubbleResult.boxes, []);
      }

      const items: DetectedTextItem[] = finalSortedBubbles.map(
        (box, index) => ({
          id: index + 1,
          box,
          ocrText: null,
          translation: null,
        })
      );

      setDetectedItems(items);
    } catch (e) {
      console.error("Detect error:", e);
      alert("Detection failed. Check API server and console for details.");
    } finally {
      setIsLoading((p) => ({ ...p, detect: false }));
    }
  }, [
    imageSrc,
    editMode,
    apiBaseUrl,
    usePanelDetection,
    setDetectedItems,
    setIsLoading,
  ]);

  return { handleDetect };
}
