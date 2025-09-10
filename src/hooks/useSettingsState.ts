// src/hooks/useSettingsState.ts
import { useEffect, useState } from "preact/hooks";

const DEFAULT_SYSTEM_PROMPT = `You are an expert manga translator.
Translate each numbered Japanese line into natural English.
Return the result as numbered lines in the same order.
Do not add explanations or any extra text.
Example:
1. こんにちは -> 1. Hello
2. さようなら -> 2. Goodbye`;

export function useSettingsState() {
  const [apiBaseUrl, setApiBaseUrl] = useState(
    () => localStorage.getItem("apiBaseUrl") || "http://localhost:8000"
  );
  const [translationUrl, setTranslationUrl] = useState(
    () => localStorage.getItem("translationUrl") || "http://localhost:1234"
  );
  const [systemPrompt, setSystemPrompt] = useState(
    () => localStorage.getItem("systemPrompt") || DEFAULT_SYSTEM_PROMPT
  );
  const [usePanelDetection, setUsePanelDetection] = useState(
    () => localStorage.getItem("usePanelDetection") !== "false"
  );
  // ИЗМЕНЕНО: Добавлено состояние для модели детекции
  const [detectionModel, setDetectionModel] = useState(
    () => localStorage.getItem("detectionModel") || "bubbles_yolo"
  );
  const [streamTranslation, setStreamTranslation] = useState(
    () => localStorage.getItem("streamTranslation") === "true"
  );
  const [enableTwoStepTranslation, setEnableTwoStepTranslation] = useState(
    () => localStorage.getItem("enableTwoStepTranslation") === "true"
  );
  const [deeplxUrl, setDeeplxUrl] = useState(
    () =>
      localStorage.getItem("deeplxUrl") || "https://deeplx.vercel.app/translate"
  );
  const [deeplxApiKey] = useState(() => "");
  const [deeplTargetLang, setDeeplTargetLang] = useState(
    () => localStorage.getItem("deeplTargetLang") || "RU"
  );
  const [ocrEngine, setOcrEngine] = useState<"manga">(() => "manga");
  const [showCanvasText, setShowCanvasText] = useState(
    () => localStorage.getItem("showCanvasText") !== "false"
  );
  const [inpaintModel, setInpaintModel] = useState(
    () => localStorage.getItem("inpaintModel") || "lama_large_512px"
  );
  const [defaultBrushSize, setDefaultBrushSize] = useState(() =>
    parseInt(localStorage.getItem("defaultBrushSize") || "20", 10)
  );

  useEffect(() => localStorage.setItem("apiBaseUrl", apiBaseUrl), [apiBaseUrl]);
  useEffect(
    () => localStorage.setItem("translationUrl", translationUrl),
    [translationUrl]
  );
  useEffect(
    () => localStorage.setItem("systemPrompt", systemPrompt),
    [systemPrompt]
  );
  useEffect(
    () => localStorage.setItem("usePanelDetection", String(usePanelDetection)),
    [usePanelDetection]
  );
  // ИЗМЕНЕНО: Сохраняем модель детекции
  useEffect(
    () => localStorage.setItem("detectionModel", detectionModel),
    [detectionModel]
  );
  useEffect(
    () => localStorage.setItem("streamTranslation", String(streamTranslation)),
    [streamTranslation]
  );
  useEffect(
    () =>
      localStorage.setItem(
        "enableTwoStepTranslation",
        String(enableTwoStepTranslation)
      ),
    [enableTwoStepTranslation]
  );
  useEffect(() => localStorage.setItem("deeplxUrl", deeplxUrl), [deeplxUrl]);
  useEffect(
    () => localStorage.setItem("deeplTargetLang", deeplTargetLang),
    [deeplTargetLang]
  );
  useEffect(
    () => localStorage.setItem("showCanvasText", String(showCanvasText)),
    [showCanvasText]
  );
  useEffect(
    () => localStorage.setItem("inpaintModel", inpaintModel),
    [inpaintModel]
  );
  useEffect(
    () => localStorage.setItem("defaultBrushSize", String(defaultBrushSize)),
    [defaultBrushSize]
  );

  return {
    apiBaseUrl,
    setApiBaseUrl,
    translationUrl,
    setTranslationUrl,
    systemPrompt,
    setSystemPrompt,
    usePanelDetection,
    setUsePanelDetection,
    detectionModel,
    setDetectionModel, // ИЗМЕНЕНО: Экспортируем новое состояние
    streamTranslation,
    setStreamTranslation,
    enableTwoStepTranslation,
    setEnableTwoStepTranslation,
    deeplxUrl,
    setDeeplxUrl,
    deeplxApiKey,
    deeplTargetLang,
    setDeeplTargetLang,
    ocrEngine,
    setOcrEngine,
    showCanvasText,
    setShowCanvasText,
    inpaintModel,
    setInpaintModel,
    defaultBrushSize,
    setDefaultBrushSize,
  };
}
