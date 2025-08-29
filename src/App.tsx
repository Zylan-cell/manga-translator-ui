import { useState, useEffect, useCallback, useRef } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";

import AppHeader from "./components/ui/AppHeader";
import ImageUploader from "./components/ui/ImageUploader";
import ImageCanvas from "./components/ui/ImageCanvas";
import ActionButtons from "./components/ui/ActionButtons";
import FloatingWindow from "./components/ui/FloatingWindow";
import Settings from "./components/ui/Settings";
import ResultDisplay from "./components/ui/ResultDisplay";
import FullscreenExitIcon from "./assets/icons/fullscreen-exit.svg?react";

import {
  DetectedTextItem,
  LoadingState,
  FloatingWindowSettings,
  BoundingBox,
  ImageInfo,
} from "./types";

import { useDetection } from "./hooks/useDetection";
import { useOcr } from "./hooks/useOcr";
import { useTranslation } from "./hooks/useTranslation";
import { useHotkeys } from "./hooks/useHotkeys";
import { useModels } from "./hooks/useModels";
import { useTextLayout, LaidOutTextItem } from "./hooks/useTextLayout";
import { drawPrecalculatedText } from "./components/canvas/draw";

const DEFAULT_SYSTEM_PROMPT = `You are an expert manga translator.
Translate each numbered Japanese line into natural English.
Return the result as numbered lines in the same order.
Do not add explanations or any extra text.
Example:
1. こんにちは -> 1. Hello
2. さようなら -> 2. Goodbye`;

export default function App() {
  // Core state
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [detectedItems, setDetectedItems] = useState<DetectedTextItem[] | null>(
    null
  );
  const [selectedBoxId, setSelectedBoxId] = useState<number | null>(null);
  const [imageList, setImageList] = useState<ImageInfo[]>([]);
  const [, setCurrentImageIndex] = useState<number>(0);

  // Loading
  const [isLoading, setIsLoading] = useState<LoadingState>({
    detect: false,
    ocr: false,
    translate: false,
    models: false,
  });

  // UI
  const [streamingLogContent, setStreamingLogContent] = useState<string | null>(
    null
  );
  const [showFloatingWindow, setShowFloatingWindow] = useState(false);
  const [floatingWindowPosition, setFloatingWindowPosition] = useState({
    x: 100,
    y: 100,
  });
  const [floatingWindowSettings, setFloatingWindowSettings] =
    useState<FloatingWindowSettings>({ showOcr: true, showTranslation: true });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isCanvasFullscreen, setCanvasFullscreen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isAddingBubble, setAddingBubble] = useState(false);

  const undoRef = useRef<() => void>(() => {});

  // Sidebars & mobile overlay
  const [isLeftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(
    () => window.innerWidth <= 1024
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // DnD overlay
  const [isHtmlDragOver, setIsHtmlDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  // Backends
  const [apiBaseUrl, setApiBaseUrl] = useState(
    () => localStorage.getItem("apiBaseUrl") || "http://localhost:8000"
  );
  const [translationUrl, setTranslationUrl] = useState(
    () => localStorage.getItem("translationUrl") || "http://localhost:1234"
  );

  // Translation options
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
    () => localStorage.getItem("deeplxUrl") || "https://dplx.xi-xu.me/translate"
  );
  const [deeplxApiKey] = useState(
    () => localStorage.getItem("deeplxApiKey") || ""
  );
  const [deeplTargetLang, setDeeplTargetLang] = useState(
    () => localStorage.getItem("deeplTargetLang") || "RU"
  );
  const [deeplOnly, setDeeplOnly] = useState(
    () => localStorage.getItem("deeplOnly") === "true"
  );

  // OCR
  const [ocrEngine, setOcrEngine] = useState<"manga">(() => "manga");

  const [showCanvasText, setShowCanvasText] = useState(
    () => localStorage.getItem("showCanvasText") !== "false"
  );

  // Models
  const { models, selectedModel, setSelectedModel, fetchModels } =
    useModels(translationUrl);

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
    () => localStorage.setItem("deeplOnly", String(deeplOnly)),
    [deeplOnly]
  );

  useEffect(
    () => localStorage.setItem("showCanvasText", String(showCanvasText)),
    [showCanvasText]
  );

  // Mutual exclusion: DeepL-only vs Two-step
  useEffect(() => {
    if (deeplOnly && enableTwoStepTranslation)
      setEnableTwoStepTranslation(false);
  }, [deeplOnly]);
  useEffect(() => {
    if (enableTwoStepTranslation && deeplOnly) setDeeplOnly(false);
  }, [enableTwoStepTranslation]);

  // Import folder
  useCallback(async () => {
    try {
      const images = await invoke<ImageInfo[]>("import_folder");
      setImageList(images);
      if (images.length > 0) {
        setCurrentImageIndex(0);
        setImageSrc(images[0].dataUrl);
      }
    } catch (error) {
      console.error("Failed to import folder:", error);
      alert("Failed to import folder. Check console for details.");
    }
  }, []);

  // Select image
  useCallback(
    (index: number) => {
      setCurrentImageIndex(index);
      setImageSrc(imageList[index].dataUrl);
      setDetectedItems(null);
      setSelectedBoxId(null);
    },
    [imageList]
  );

  // Upload
  const handleImageUpload = useCallback((dataUrl: string) => {
    setImageSrc(dataUrl);
    setDetectedItems([]);
    setSelectedBoxId(null);
    setIsLoading({
      detect: false,
      ocr: false,
      translate: false,
      models: false,
    });
  }, []);

  // HTML5 DnD
  useEffect(() => {
    const shouldHandle = (dt: DataTransfer | null) => {
      if (!dt) return false;
      const t = Array.from(dt.types || []);
      return (
        t.includes("Files") ||
        t.includes("text/uri-list") ||
        t.includes("text/html")
      );
    };

    const onDragEnter = (e: DragEvent) => {
      if (!shouldHandle(e.dataTransfer)) return;
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current += 1;
      setIsHtmlDragOver(true);
      e.dataTransfer && (e.dataTransfer.dropEffect = "copy");
    };
    const onDragOver = (e: DragEvent) => {
      if (!shouldHandle(e.dataTransfer)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer && (e.dataTransfer.dropEffect = "copy");
    };
    const onDragLeave = (e: DragEvent) => {
      if (!shouldHandle(e.dataTransfer)) return;
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) setIsHtmlDragOver(false);
    };

    const processBlob = (b?: Blob) => {
      if (!b) return;
      const r = new FileReader();
      r.onload = (ev) => {
        const res = ev.target?.result as string;
        if (res) handleImageUpload(res);
      };
      r.readAsDataURL(b);
    };
    const tryFetchAsBlob = async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const buf = await res.arrayBuffer();
      return new Blob([buf]);
    };
    const tryFetchViaTauri = async (url: string) => {
      const b64 = await invoke<string>("fetch_image", { url });
      const bin = atob(b64);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return new Blob([u8.buffer]);
    };
    const extractUrlFromUriList = (t: string) => {
      const lines = t.split(/\r?\n/).map((s) => s.trim());
      for (const l of lines) if (l && !l.startsWith("#")) return l;
      return null;
    };
    const extractImgSrcFromHtml = (html: string) => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const img = doc.querySelector("img");
      return img?.src || null;
    };

    const onDrop = async (e: DragEvent) => {
      if (!shouldHandle(e.dataTransfer)) return;
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsHtmlDragOver(false);

      const dt = e.dataTransfer!;
      if (dt.files?.length) {
        const f =
          Array.from(dt.files).find((f) => f.type.startsWith("image/")) ||
          dt.files[0];
        processBlob(f);
        return;
      }
      const uriList = dt.getData("text/uri-list");
      const url = uriList ? extractUrlFromUriList(uriList) : null;
      if (url) {
        try {
          processBlob(await tryFetchAsBlob(url));
          return;
        } catch {
          try {
            processBlob(await tryFetchViaTauri(url));
            return;
          } catch {}
        }
      }
      const html = dt.getData("text/html");
      const src = html ? extractImgSrcFromHtml(html) : null;
      if (src) {
        try {
          processBlob(await tryFetchAsBlob(src));
          return;
        } catch {
          try {
            processBlob(await tryFetchViaTauri(src));
            return;
          } catch {}
        }
      }
    };

    document.addEventListener("dragenter", onDragEnter, true);
    document.addEventListener("dragover", onDragOver, true);
    document.addEventListener("dragleave", onDragLeave, true);
    document.addEventListener("drop", onDrop, true);
    return () => {
      document.removeEventListener("dragenter", onDragEnter, true);
      document.removeEventListener("dragover", onDragOver, true);
      document.removeEventListener("dragleave", onDragLeave, true);
      document.removeEventListener("drop", onDrop, true);
    };
  }, [handleImageUpload]);

  // Layout для текста: добавляем layout только если showCanvasText
  const laidOut = useTextLayout(showCanvasText ? detectedItems : null);
  const itemsForCanvas: LaidOutTextItem[] | null = detectedItems
    ? detectedItems.map((i) => {
        const layout = laidOut?.find((x) => x.id === i.id)?.layout;
        return layout
          ? ({ ...i, layout } as LaidOutTextItem)
          : ({ ...i } as LaidOutTextItem);
      })
    : null;

  // Hooks
  const { handleDetect } = useDetection({
    imageSrc,
    editMode,
    apiBaseUrl,
    setDetectedItems,
    setIsLoading,
    usePanelDetection,
  });

  const { recognizeAllBubbles } = useOcr({
    imageSrc,
    detectedItems,
    editMode,
    apiBaseUrl,
    setDetectedItems,
    setIsLoading,
    ocrEngine,
    easyOcrLangs: "en",
  });

  const { translateAllBubbles } = useTranslation({
    detectedItems,
    editMode,
    selectedModel,
    translationUrl,
    systemPrompt,
    enableTwoStepTranslation,
    deeplxUrl,
    deeplxApiKey,
    streamTranslation,
    setDetectedItems,
    setIsLoading,
    onStreamUpdate: setStreamingLogContent,
    onStreamEnd: () => setStreamingLogContent(null),
    deeplTargetLang,
    deeplOnly,
  });

  // Callbacks
  const handleUpdateTextFields = useCallback(
    (id: number, fields: Partial<DetectedTextItem>) => {
      setDetectedItems((prev) =>
        prev
          ? prev.map((it) => (it.id === id ? { ...it, ...fields } : it))
          : prev
      );
    },
    []
  );

  const toggleEditMode = useCallback(() => {
    if (!imageSrc) return;
    setEditMode((prev) => {
      if (prev) {
        setAddingBubble(false);
        setSelectedBoxId(null);
      }
      return !prev;
    });
  }, [imageSrc]);

  const handleAddBubble = useCallback((newBox: BoundingBox) => {
    setDetectedItems((prev) => {
      const arr = prev || [];
      const maxId = arr.reduce((m, it) => Math.max(m, it.id), 0);
      return [
        ...arr,
        {
          id: maxId + 1,
          box: newBox,
          ocrText: null,
          translation: null,
          textProperties: {
            fontFamily: "Arial",
            fontSize: 16,
            fontWeight: "normal",
            fontStyle: "normal",
            textDecoration: "none",
            color: "#000000",
            strokeColor: "#FFFFFF",
            strokeWidth: 2,
          },
        },
      ];
    });
    setAddingBubble(false);
  }, []);

  const handleUpdateBubble = useCallback((id: number, newBox: BoundingBox) => {
    setDetectedItems((prev) =>
      prev
        ? prev.map((it) => (it.id === id ? { ...it, box: newBox } : it))
        : null
    );
  }, []);

  const handleDeleteBubble = useCallback(() => {
    if (selectedBoxId === null || !editMode) return;
    setDetectedItems((prev) => {
      if (!prev) return null;
      const next = prev.filter((it) => it.id !== selectedBoxId);
      // перенумерация подряд
      return next.map((it, idx) => ({ ...it, id: idx + 1 }));
    });
    setSelectedBoxId(null);
  }, [selectedBoxId, editMode]);

  const toggleAddBubble = useCallback(() => {
    if (!editMode || !imageSrc) return;
    setAddingBubble((p) => !p);
  }, [editMode, imageSrc]);

  const handleExportImage = useCallback(async () => {
    if (!imageSrc || !laidOut) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      for (const it of laidOut) {
        if (it.translation && it.layout)
          drawPrecalculatedText(ctx, it.box, it.layout);
      }
      const link = document.createElement("a");
      link.download = `translated-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = imageSrc;
  }, [imageSrc, laidOut]);

  const closeSettings = useCallback(() => setShowSettingsModal(false), []);
  const exitFullscreen = useCallback(() => setCanvasFullscreen(false), []);
  const cancelAddBubble = useCallback(() => setAddingBubble(false), []);

  const handleBoxSelect = useCallback(
    (itemOrId: DetectedTextItem | null) => {
      if (isAddingBubble) return;
      const id = itemOrId?.id ?? null;
      setSelectedBoxId(id);
      if (id !== null) setShowFloatingWindow(true);
    },
    [isAddingBubble]
  );

  // Hotkeys
  useHotkeys({
    editMode,
    isCanvasFullscreen,
    isAddingBubble,
    showSettingsModal,
    toggleEditMode,
    toggleAddBubble,
    handleDeleteBubble,
    handleDetect,
    recognizeAllBubbles,
    translateAllBubbles,
    exitFullscreen,
    cancelAddBubble,
    closeSettings,
    onUndo: () => undoRef.current?.(),
  });

  return (
    <div class="app-root">
      <div class="app-container">
        <AppHeader
          onToggleLeftSidebar={() => setLeftSidebarOpen((p) => !p)}
          onToggleRightSidebar={() => setRightSidebarOpen((p) => !p)}
          onShowSettings={() => setShowSettingsModal(true)}
        />

        <main class="app-main">
          {/* Левая панель */}
          <div className={`left-sidebar ${isLeftSidebarOpen ? "is-open" : ""}`}>
            <ImageUploader onImageUpload={handleImageUpload} />
            <ActionButtons
              imageSrc={imageSrc}
              isLoading={isLoading}
              onDetect={handleDetect}
              onRecognize={recognizeAllBubbles}
              onTranslate={translateAllBubbles}
              onExportImage={handleExportImage}
              editMode={editMode}
              onToggleEditMode={toggleEditMode}
              isAddingBubble={isAddingBubble}
              onToggleAddBubble={toggleAddBubble}
              onDeleteBubble={handleDeleteBubble}
              selectedBubbleId={selectedBoxId}
            />
          </div>

          {/* Центральная область */}
          <div class="main-workspace">
            <ImageCanvas
              imageSrc={imageSrc}
              detectedItems={itemsForCanvas}
              selectedBoxId={selectedBoxId}
              editMode={editMode}
              isAdding={isAddingBubble}
              onBoxSelect={handleBoxSelect}
              onAddBubble={handleAddBubble}
              onUpdateBubble={handleUpdateBubble}
              onUndoExternal={(fn) => {
                undoRef.current = fn;
              }}
            />
          </div>

          {/* Правая панель */}
          <div
            className={`right-sidebar ${isRightSidebarOpen ? "is-open" : ""}`}
          >
            {streamingLogContent !== null && (
              <div
                class="workspace-panel"
                style={{ flex: "0 1 40%", marginBottom: "var(--spacing-4)" }}
              >
                <div class="workspace-panel-header">
                  <h2>⚡️ Translation Stream Log</h2>
                </div>
                <div
                  class="workspace-panel-content"
                  style={{
                    backgroundColor: "#f9fafb",
                    padding: "var(--spacing-3)",
                    overflow: "auto",
                  }}
                >
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      margin: 0,
                      fontSize: "var(--font-size-sm)",
                      color: "#374151",
                      fontFamily: "var(--font-family-mono)",
                    }}
                  >
                    {streamingLogContent || "Waiting for stream..."}
                  </pre>
                </div>
              </div>
            )}

            <ResultDisplay
              detectedItems={detectedItems}
              selectedBoxId={selectedBoxId}
              onBoxSelect={handleBoxSelect}
              editMode={editMode}
              onReorder={(sourceId, targetId) =>
                setDetectedItems((prev) => {
                  if (!prev) return null;
                  const items = [...prev];
                  const from = items.findIndex((i) => i.id === sourceId);
                  const to = items.findIndex((i) => i.id === targetId);
                  if (from === -1 || to === -1) return items;
                  const [moved] = items.splice(from, 1);
                  items.splice(to, 0, moved);
                  return items.map((it, idx) => ({ ...it, id: idx + 1 }));
                })
              }
            />
          </div>
        </main>
      </div>

      {/* Пелена только на мобильных */}
      {isMobile && (isLeftSidebarOpen || isRightSidebarOpen) && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 1999,
          }}
          onClick={() => {
            setLeftSidebarOpen(false);
            setRightSidebarOpen(false);
          }}
        />
      )}

      {/* DnD overlay — не блокирует клики */}
      {isHtmlDragOver && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 3000,
            background: "rgba(59,130,246,0.08)",
            border: "3px dashed #3b82f6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#1e40af",
            fontSize: "1.1rem",
            fontWeight: 600,
            pointerEvents: "none",
          }}
        >
          Drop image to import
        </div>
      )}

      {/* Fullscreen (optional) */}
      {isCanvasFullscreen && (
        <div class="fullscreen-canvas-container">
          <button
            class="btn btn-outline fullscreen-exit-btn"
            onClick={exitFullscreen}
            title="Exit Fullscreen (Esc)"
          >
            <FullscreenExitIcon class="icon" /> Exit Fullscreen
          </button>
        </div>
      )}

      {/* Floating window */}
      {showFloatingWindow && selectedBoxId !== null && (
        <FloatingWindow
          position={floatingWindowPosition}
          settings={floatingWindowSettings}
          detectedItems={detectedItems}
          selectedBoxId={selectedBoxId}
          onPositionUpdate={(x, y) => setFloatingWindowPosition({ x, y })}
          onSettingsUpdate={(s) => setFloatingWindowSettings(s)}
          onClose={() => setShowFloatingWindow(false)}
          editMode={editMode}
          onUpdateText={handleUpdateTextFields}
        />
      )}

      {/* Settings modal */}
      {showSettingsModal && (
        <div class="settings-modal-overlay" onClick={closeSettings}>
          <div
            class="settings-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="settings-modal-header">
              <h2>Settings</h2>
              <button
                class="close-button"
                onClick={closeSettings}
                title="Close (Esc)"
              >
                ✕
              </button>
            </div>
            <div class="settings-modal-body">
              <Settings
                apiBaseUrl={apiBaseUrl}
                setApiBaseUrl={setApiBaseUrl}
                translationUrl={translationUrl}
                setTranslationUrl={setTranslationUrl}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                models={models}
                fetchModels={fetchModels}
                systemPrompt={systemPrompt}
                setSystemPrompt={setSystemPrompt}
                usePanelDetection={usePanelDetection}
                setUsePanelDetection={setUsePanelDetection}
                streamTranslation={streamTranslation}
                setStreamTranslation={setStreamTranslation}
                enableTwoStepTranslation={enableTwoStepTranslation}
                setEnableTwoStepTranslation={setEnableTwoStepTranslation}
                deeplxUrl={deeplxUrl}
                setDeeplxUrl={setDeeplxUrl}
                ocrEngine={ocrEngine}
                setOcrEngine={setOcrEngine}
                showCanvasText={showCanvasText}
                setShowCanvasText={setShowCanvasText}
                deeplOnly={deeplOnly}
                setDeeplOnly={setDeeplOnly}
                deeplTargetLang={deeplTargetLang}
                setDeeplTargetLang={setDeeplTargetLang}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
