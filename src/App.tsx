import { useState, useEffect, useCallback, useRef } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";

// --- ИСПОЛЬЗУЕМ ПРАВИЛЬНЫЕ ИМПОРТЫ И ТИПЫ ИЗ ПЛАГИНОВ ---
import {
  listenForShareEvents,
  type ShareEvent,
} from "tauri-plugin-sharetarget-api";
import { readFile } from "@tauri-apps/plugin-fs";

import AppHeader from "./components/ui/AppHeader";
import ImageUploader from "./components/ui/ImageUploader";
import ImageCanvas from "./components/ui/ImageCanvas";
import ActionButtons from "./components/ui/ActionButtons";
import FloatingWindow from "./components/ui/FloatingWindow";
import Settings from "./components/ui/Settings";
import ResultDisplay from "./components/ui/ResultDisplay";
import { FullscreenExitIcon } from "./components/ui/Icons";
import {
  DetectedTextItem,
  LoadingState,
  FloatingWindowSettings,
  BoundingBox,
  InpaintResponse,
} from "./types";
import { useDetection } from "./hooks/useDetection";
import { useOcr } from "./hooks/useOcr";
import { useTranslation } from "./hooks/useTranslation";
import { useHotkeys } from "./hooks/useHotkeys";
import { useModels } from "./hooks/useModels";
import { useTextLayout } from "./hooks/useTextLayout";
import { drawPrecalculatedText } from "./components/canvas/draw";

const DEFAULT_SYSTEM_PROMPT = `You are an expert manga translator.
Translate each numbered Japanese line into natural English.
Return the result as numbered lines in the same order.
Do not add explanations or any extra text.
Example:
1. こんにちは -> 1. Hello
2. さようなら -> 2. Goodbye`;

export default function App() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [detectedItems, setDetectedItems] = useState<DetectedTextItem[] | null>(
    null
  );
  const laidOutItems = useTextLayout(detectedItems);
  const [selectedBoxId, setSelectedBoxId] = useState<number | null>(null);

  const [isLoading, setIsLoading] = useState<LoadingState>({
    detect: false,
    ocr: false,
    translate: false,
    models: false,
    inpaint: false,
  });

  const [streamingLogContent, setStreamingLogContent] = useState<string | null>(
    null
  );
  const [showFloatingWindow, setShowFloatingWindow] = useState(false);
  const [floatingWindowPosition, setFloatingWindowPosition] = useState({
    x: 100,
    y: 100,
  });
  const [floatingWindowSettings, setFloatingWindowSettings] =
    useState<FloatingWindowSettings>({
      showOcr: true,
      showTranslation: true,
    });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isCanvasFullscreen, setCanvasFullscreen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isAddingBubble, setAddingBubble] = useState(false);
  const [maskMode, setMaskMode] = useState(false);
  const [eraseMode, setEraseMode] = useState(false);
  const [brushSize, setBrushSize] = useState(24);
  const [takeMaskSnapshotSig, setTakeMaskSnapshotSig] = useState(0);
  const [clearMaskSig, setClearMaskSig] = useState(0);
  const undoRef = useRef<() => void>(() => {});

  const [isLeftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setRightSidebarOpen] = useState(false);

  const [apiBaseUrl, setApiBaseUrl] = useState(
    () => localStorage.getItem("apiBaseUrl") || "http://localhost:8000"
  );
  const [translationUrl, setTranslationUrl] = useState(
    () => localStorage.getItem("translationUrl") || "http://localhost:1234"
  );
  const [systemPrompt, setSystemPrompt] = useState(
    () => localStorage.getItem("systemPrompt") || DEFAULT_SYSTEM_PROMPT
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
  const [streamTranslation, setStreamTranslation] = useState(
    () => localStorage.getItem("streamTranslation") === "true"
  );
  const [usePanelDetection, setUsePanelDetection] = useState(
    () => localStorage.getItem("usePanelDetection") !== "false"
  );

  const { models, selectedModel, setSelectedModel, fetchModels } =
    useModels(translationUrl);

  useEffect(() => {
    localStorage.setItem("apiBaseUrl", apiBaseUrl);
  }, [apiBaseUrl]);
  useEffect(() => {
    localStorage.setItem("translationUrl", translationUrl);
  }, [translationUrl]);
  useEffect(() => {
    localStorage.setItem("systemPrompt", systemPrompt);
  }, [systemPrompt]);
  useEffect(() => {
    localStorage.setItem(
      "enableTwoStepTranslation",
      String(enableTwoStepTranslation)
    );
  }, [enableTwoStepTranslation]);
  useEffect(() => {
    localStorage.setItem("deeplxUrl", deeplxUrl);
  }, [deeplxUrl]);
  useEffect(() => {
    localStorage.setItem("streamTranslation", String(streamTranslation));
  }, [streamTranslation]);
  useEffect(() => {
    localStorage.setItem("usePanelDetection", String(usePanelDetection));
  }, [usePanelDetection]);

  const handleImageUpload = useCallback((dataUrl: string) => {
    setImageSrc(dataUrl);
    setDetectedItems([]);
    setSelectedBoxId(null);
    setIsLoading({
      detect: false,
      ocr: false,
      translate: false,
      models: false,
      inpaint: false,
    });
    setMaskMode(false);
    setClearMaskSig((s) => s + 1);
  }, []);

  useEffect(() => {
    let unlisten: any;
    const setupListener = async () => {
      unlisten = await listenForShareEvents(async (event: ShareEvent) => {
        if (event.stream) {
          try {
            const contents = await readFile(event.stream);
            const blob = new Blob([new Uint8Array(contents)], {
              type: event.content_type || "image/jpeg",
            });
            const dataUrl = URL.createObjectURL(blob);
            handleImageUpload(dataUrl);
          } catch (e) {
            console.error("Error reading shared file:", e);
          }
        }
      });
    };
    setupListener();
    return () => {
      unlisten?.unregister();
    };
  }, [handleImageUpload]);

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
  });

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
      const isExiting = prev;
      if (isExiting) {
        setAddingBubble(false);
        setMaskMode(false);
        setSelectedBoxId(null);
      }
      return !prev;
    });
  }, [imageSrc]);
  const handleAddBubble = useCallback((newBox: BoundingBox) => {
    setDetectedItems((prev) => {
      const items = prev || [];
      const maxId = items.reduce((max, item) => Math.max(max, item.id), 0);
      return [
        ...items,
        { id: maxId + 1, box: newBox, ocrText: null, translation: null },
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
    setDetectedItems((prev) =>
      prev ? prev.filter((it) => it.id !== selectedBoxId) : null
    );
    setSelectedBoxId(null);
  }, [selectedBoxId, editMode]);
  const toggleAddBubble = useCallback(() => {
    if (!editMode || !imageSrc) return;
    setAddingBubble((p) => !p);
  }, [editMode, imageSrc]);
  const handleInpaintAuto = useCallback(async () => {
    if (!imageSrc || !detectedItems || detectedItems.length === 0) return;
    try {
      setIsLoading((p) => ({ ...p, inpaint: true }));
      const base64Image = imageSrc.split(",")[1];
      const boxes = detectedItems.map((it) => [
        Math.round(it.box.x1),
        Math.round(it.box.y1),
        Math.round(it.box.x2),
        Math.round(it.box.y2),
      ]);
      const resp = await invoke<InpaintResponse>("inpaint_text_auto", {
        apiUrl: apiBaseUrl,
        imageData: base64Image,
        boxes,
        dilate: 2,
      });
      setImageSrc(`data:image/png;base64,${resp.image_data}`);
    } catch (e) {
      console.error("Auto inpaint error:", e);
    } finally {
      setIsLoading((p) => ({ ...p, inpaint: false }));
    }
  }, [imageSrc, detectedItems, apiBaseUrl]);
  const handleExportImage = useCallback(async () => {
    if (!imageSrc || !laidOutItems) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      for (const item of laidOutItems) {
        if (item.translation && item.layout) {
          drawPrecalculatedText(ctx, item.box, item.layout);
        }
      }
      const link = document.createElement("a");
      link.download = `translated-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = imageSrc;
  }, [imageSrc, laidOutItems]);
  const closeSettings = useCallback(() => setShowSettingsModal(false), []);
  const toggleCanvasFullscreen = useCallback(
    () => setCanvasFullscreen((p) => !p),
    []
  );
  const exitFullscreen = useCallback(() => setCanvasFullscreen(false), []);
  const cancelAddBubble = useCallback(() => setAddingBubble(false), []);
  const handleBoxSelect = useCallback(
    (itemOrId: DetectedTextItem | null) => {
      if (isAddingBubble) return;
      const newSelectedId = itemOrId?.id ?? null;
      setSelectedBoxId(newSelectedId);
      if (newSelectedId !== null) setShowFloatingWindow(true);
    },
    [isAddingBubble]
  );

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
          <div class="main-content-grid">
            <div
              className={`left-sidebar ${isLeftSidebarOpen ? "is-open" : ""}`}
            >
              <ImageUploader onImageUpload={handleImageUpload} />
              <ActionButtons
                imageSrc={imageSrc}
                isLoading={isLoading}
                onDetect={handleDetect}
                onRecognize={recognizeAllBubbles}
                onTranslate={translateAllBubbles}
                onExportImage={handleExportImage}
                onInpaintAuto={handleInpaintAuto}
                editMode={editMode}
                onToggleEditMode={toggleEditMode}
                isAddingBubble={isAddingBubble}
                onToggleAddBubble={toggleAddBubble}
                onDeleteBubble={handleDeleteBubble}
                selectedBubbleId={selectedBoxId}
                maskMode={maskMode}
                onToggleMaskMode={() => setMaskMode((v) => !v)}
                brushSize={brushSize}
                onBrushSizeChange={setBrushSize}
                eraseMode={eraseMode}
                onToggleEraseMode={() => setEraseMode((v) => !v)}
                onApplyInpaint={() => setTakeMaskSnapshotSig((s) => s + 1)}
                onClearMask={() => {
                  if (confirm("Clear entire mask?"))
                    setClearMaskSig((s) => s + 1);
                }}
              />
            </div>

            <div class="main-workspace">
              <ImageCanvas
                imageSrc={imageSrc}
                detectedItems={laidOutItems}
                selectedBoxId={selectedBoxId}
                editMode={editMode}
                isAdding={isAddingBubble}
                onBoxSelect={handleBoxSelect}
                onAddBubble={handleAddBubble}
                onUpdateBubble={handleUpdateBubble}
                maskMode={maskMode}
                eraseMode={eraseMode}
                brushSize={brushSize}
                takeManualMaskSnapshot={takeMaskSnapshotSig}
                onMaskSnapshot={async (dataUrl) => {
                  if (!dataUrl || !imageSrc) return;
                  try {
                    setIsLoading((p) => ({ ...p, inpaint: true }));
                    const resp = await invoke<InpaintResponse>(
                      "inpaint_image",
                      {
                        apiUrl: apiBaseUrl,
                        imageData: imageSrc.split(",")[1],
                        maskData: dataUrl.split(",")[1],
                      }
                    );
                    setImageSrc(`data:image/png;base64,${resp.image_data}`);
                    setMaskMode(false);
                  } catch (e) {
                    console.error("Manual inpaint error:", e);
                  } finally {
                    setIsLoading((p) => ({ ...p, inpaint: false }));
                  }
                }}
                clearMaskSignal={clearMaskSig}
                onMaskCleared={() => {}}
                onUndoExternal={(fn) => {
                  undoRef.current = fn;
                }}
              />
            </div>

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
                        wordBreak: "break-all",
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
                    const sourceIndex = items.findIndex(
                      (i) => i.id === sourceId
                    );
                    const targetIndex = items.findIndex(
                      (i) => i.id === targetId
                    );
                    if (sourceIndex === -1 || targetIndex === -1) return items;
                    const [draggedItem] = items.splice(sourceIndex, 1);
                    items.splice(targetIndex, 0, draggedItem);
                    return items.map((it, i) => ({ ...it, id: i + 1 }));
                  })
                }
              />
            </div>
          </div>
        </main>
      </div>

      {(isLeftSidebarOpen || isRightSidebarOpen) && (
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

      {isCanvasFullscreen && (
        <div class="fullscreen-canvas-container">
          {" "}
          <ImageCanvas
            imageSrc={imageSrc}
            detectedItems={laidOutItems}
            selectedBoxId={selectedBoxId}
            editMode={editMode}
            isAdding={isAddingBubble}
            onBoxSelect={handleBoxSelect}
            onAddBubble={handleAddBubble}
            onUpdateBubble={handleUpdateBubble}
            maskMode={maskMode}
            eraseMode={eraseMode}
            brushSize={brushSize}
            takeManualMaskSnapshot={takeMaskSnapshotSig}
            onMaskSnapshot={async (dataUrl) => {
              if (!dataUrl || !imageSrc) return;
              try {
                setIsLoading((p) => ({ ...p, inpaint: true }));
                const resp = await invoke<InpaintResponse>("inpaint_image", {
                  apiUrl: apiBaseUrl,
                  imageData: imageSrc.split(",")[1],
                  maskData: dataUrl.split(",")[1],
                });
                setImageSrc(`data:image/png;base64,${resp.image_data}`);
                setMaskMode(false);
              } catch (e) {
                console.error("Manual inpaint error:", e);
              } finally {
                setIsLoading((p) => ({ ...p, inpaint: false }));
              }
            }}
            clearMaskSignal={clearMaskSig}
            onMaskCleared={() => {}}
            onUndoExternal={(fn) => {
              undoRef.current = fn;
            }}
          />{" "}
          <button
            class="btn btn-outline fullscreen-exit-btn"
            onClick={toggleCanvasFullscreen}
            title="Exit Fullscreen (Esc)"
          >
            {" "}
            <FullscreenExitIcon /> Exit Fullscreen{" "}
          </button>{" "}
        </div>
      )}
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
      {showSettingsModal && (
        <div class="settings-modal-overlay" onClick={closeSettings}>
          {" "}
          <div
            class="settings-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            {" "}
            <div class="settings-modal-header">
              {" "}
              <h2>Settings</h2>{" "}
              <button
                class="close-button"
                onClick={closeSettings}
                title="Close (Esc)"
              >
                ✕
              </button>{" "}
            </div>{" "}
            <div class="settings-modal-body">
              {" "}
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
                enableTwoStepTranslation={enableTwoStepTranslation}
                setEnableTwoStepTranslation={setEnableTwoStepTranslation}
                deeplxUrl={deeplxUrl}
                setDeeplxUrl={setDeeplxUrl}
                streamTranslation={streamTranslation}
                setStreamTranslation={setStreamTranslation}
                usePanelDetection={usePanelDetection}
                setUsePanelDetection={setUsePanelDetection}
              />{" "}
            </div>{" "}
          </div>{" "}
        </div>
      )}
    </div>
  );
}
