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

  // Cleanup old localStorage values
  useEffect(() => {
    localStorage.removeItem("deeplOnly");
  }, []);

  // Persist
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

  // Взаимоисключающие режимы убраны

  return {
    apiBaseUrl,
    setApiBaseUrl,
    translationUrl,
    setTranslationUrl,
    systemPrompt,
    setSystemPrompt,
    usePanelDetection,
    setUsePanelDetection,
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
  };
}
