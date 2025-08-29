// src/App.tsx
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import AppHeader from "./components/ui/AppHeader";
import ImageCanvas from "./components/ui/ImageCanvas";
import FloatingWindow from "./components/ui/FloatingWindow";
import Settings from "./components/ui/Settings";
import ResultDisplay from "./components/ui/ResultDisplay";
import FullscreenExitIcon from "./assets/icons/fullscreen-exit.svg?react";
import ImageList from "./components/ui/ImageList";
import ContextMenu from "./components/ui/ContextMenu";
import TopProgressBar from "./components/ui/TopProgressBar";

import { DetectedTextItem, LoadingState, BoundingBox } from "./types";
import { useDetection } from "./hooks/useDetection";
import { useOcr } from "./hooks/useOcr";
import { useTranslation } from "./hooks/useTranslation";
import { useHotkeys } from "./hooks/useHotkeys";
import { useModels } from "./hooks/useModels";
import { useTextLayout, LaidOutTextItem } from "./hooks/useTextLayout";

import { useSettingsState } from "./hooks/useSettingsState";
import { useImageLibrary } from "./hooks/useImageLibrary";
import { useDnDImport } from "./hooks/useDnDImport";
import { useProcessAll } from "./hooks/useProcessAll";
import { useContextMenu } from "./hooks/useContextMenu";
import { ProgressState } from "./types/ui";
import { drawPrecalculatedText } from "./components/canvas/draw";

export default function App() {
  const [detectedItems, setDetectedItems] = useState<DetectedTextItem[] | null>(
    null
  );
  const [selectedBoxId, setSelectedBoxId] = useState<number | null>(null);
  const [showFloatingWindow, setShowFloatingWindow] = useState(false);
  const [floatingWindowPosition, setFloatingWindowPosition] = useState({
    x: 100,
    y: 100,
  });
  const [streamingLogContent, setStreamingLogContent] = useState<string | null>(
    null
  );
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isCanvasFullscreen, setCanvasFullscreen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isAddingBubble, setAddingBubble] = useState(false);
  const [, setIsLoading] = useState<LoadingState>({
    detect: false,
    ocr: false,
    translate: false,
    models: false,
  });
  const [progress, setProgress] = useState<ProgressState>({
    active: false,
    current: 0,
    total: 0,
    label: "",
  });
  const undoRef = useRef<() => void>(() => {});

  const settings = useSettingsState();
  const { models, selectedModel, setSelectedModel, fetchModels } = useModels(
    settings.translationUrl
  );

  const {
    imageList,
    setImageList,
    currentImageIndex,
    setCurrentImageIndex,
    imageSrc,
    setImageSrc,
    handleImportImages,
    loadImageByIndex,
    selectImageAt,
  } = useImageLibrary(setProgress);

  // При смене текущего изображения или обновлении списка — подставляем его items
  useEffect(() => {
    const cur = imageList[currentImageIndex];
    if (cur) setDetectedItems(cur.items ?? null);
  }, [currentImageIndex, imageList]);

  const laidOut = useTextLayout(settings.showCanvasText ? detectedItems : null);
  const itemsForCanvas: LaidOutTextItem[] | null = detectedItems
    ? detectedItems.map((i) => {
        const layout = laidOut?.find((x) => x.id === i.id)?.layout;
        return layout
          ? ({ ...i, layout } as LaidOutTextItem)
          : ({ ...i } as LaidOutTextItem);
      })
    : null;

  const { handleDetect } = useDetection({
    imageSrc,
    editMode,
    apiBaseUrl: settings.apiBaseUrl,
    setDetectedItems,
    setIsLoading,
    usePanelDetection: settings.usePanelDetection,
  });
  const { recognizeAllBubbles } = useOcr({
    imageSrc,
    detectedItems,
    editMode,
    apiBaseUrl: settings.apiBaseUrl,
    setDetectedItems,
    setIsLoading,
    ocrEngine: settings.ocrEngine,
    easyOcrLangs: "en",
  });
  const { translateAllBubbles } = useTranslation({
    detectedItems,
    editMode,
    selectedModel,
    translationUrl: settings.translationUrl,
    systemPrompt: settings.systemPrompt,
    enableTwoStepTranslation: settings.enableTwoStepTranslation,
    deeplxUrl: settings.deeplxUrl,
    deeplxApiKey: settings.deeplxApiKey,
    streamTranslation: settings.streamTranslation,
    setDetectedItems,
    setIsLoading,
    onStreamUpdate: setStreamingLogContent,
    onStreamEnd: () => setStreamingLogContent(null),
    deeplTargetLang: settings.deeplTargetLang,
    deeplOnly: settings.deeplOnly,
  });

  const { processCurrentAll, processAllImagesAll } = useProcessAll({
    apiBaseUrl: settings.apiBaseUrl,
    usePanelDetection: settings.usePanelDetection,
    translationUrl: settings.translationUrl,
    selectedModel,
    systemPrompt: settings.systemPrompt,
    deeplOnly: settings.deeplOnly,
    enableTwoStepTranslation: settings.enableTwoStepTranslation,
    deeplxUrl: settings.deeplxUrl,
    deeplxApiKey: settings.deeplxApiKey,
    deeplTargetLang: settings.deeplTargetLang,
    setDetectedItems,
    setImageList,
    setProgress,
  });

  const onImageLoaded = useCallback(
    (dataUrl: string) => {
      setImageSrc(dataUrl);
      setDetectedItems([]);
      setSelectedBoxId(null);
    },
    [setImageSrc]
  );
  const { isHtmlDragOver } = useDnDImport(onImageLoaded);

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
            color: "#000",
            strokeColor: "#FFF",
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
    setDetectedItems((prev) =>
      prev
        ? prev
            .filter((it) => it.id !== selectedBoxId)
            .map((it, idx) => ({ ...it, id: idx + 1 }))
        : null
    );
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
      for (const it of laidOut)
        if (it.translation && it.layout)
          drawPrecalculatedText(ctx, it.box, it.layout);
      const link = document.createElement("a");
      link.download = `translated-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = imageSrc;
  }, [imageSrc, laidOut]);
  const handleBoxSelect = useCallback(
    (itemOrId: DetectedTextItem | null) => {
      if (isAddingBubble) return;
      const id = itemOrId?.id ?? null;
      setSelectedBoxId(id);
      if (id !== null) setShowFloatingWindow(true);
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
    exitFullscreen: () => setCanvasFullscreen(false),
    cancelAddBubble: () => setAddingBubble(false),
    closeSettings: () => setShowSettingsModal(false),
    onUndo: () => undoRef.current?.(),
  });

  const { ctxMenu, openContextMenu, closeContextMenu, menuItems } =
    useContextMenu({
      imageSrc,
      editMode,
      isAddingBubble,
      selectedBoxId,
      detectedItems,
      imageList,
      progress,
      toggleEditMode,
      toggleAddBubble,
      handleDeleteBubble,
      handleDetect,
      recognizeAllBubbles,
      translateAllBubbles,
      processCurrentAll: () =>
        processCurrentAll(imageSrc, imageList[currentImageIndex]),
      processAllImagesAll: () =>
        processAllImagesAll(imageList, setCurrentImageIndex, setImageSrc),
      handleExportImage,
    });

  return (
    <div class="app-root">
      <div class="app-container">
        <AppHeader
          onImportImages={handleImportImages}
          onShowSettings={() => setShowSettingsModal(true)}
        />
        <TopProgressBar
          active={progress.active}
          current={progress.current}
          total={progress.total}
          label={progress.label}
        />
        <main class="app-main">
          <div className="left-sidebar">
            <ImageList
              images={imageList}
              currentIndex={currentImageIndex}
              onSelect={selectImageAt}
            />
          </div>
          <div
            class="main-workspace"
            onContextMenu={(e) => openContextMenu(e as any)}
          >
            <ImageCanvas
              imageSrc={imageSrc}
              detectedItems={itemsForCanvas}
              selectedBoxId={selectedBoxId}
              editMode={editMode}
              isAdding={isAddingBubble}
              onBoxSelect={handleBoxSelect}
              onAddBubble={handleAddBubble}
              onUpdateBubble={handleUpdateBubble}
              onUndoExternal={(fn) => (undoRef.current = fn)}
            />
          </div>
          <div className="right-sidebar">
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
                  const to =
                    targetId === -1
                      ? items.length - 1
                      : items.findIndex((i) => i.id === targetId);
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

      {isCanvasFullscreen && (
        <div class="fullscreen-canvas-container">
          <button
            class="btn btn-outline fullscreen-exit-btn"
            onClick={() => setCanvasFullscreen(false)}
            title="Exit Fullscreen (Esc)"
          >
            <FullscreenExitIcon class="icon" /> Exit Fullscreen
          </button>
        </div>
      )}

      {showFloatingWindow && selectedBoxId !== null && (
        <FloatingWindow
          position={floatingWindowPosition}
          settings={{ showOcr: true, showTranslation: true }}
          detectedItems={detectedItems}
          selectedBoxId={selectedBoxId}
          onPositionUpdate={(x, y) => setFloatingWindowPosition({ x, y })}
          onSettingsUpdate={() => {}}
          onClose={() => setShowFloatingWindow(false)}
          editMode={editMode}
          onUpdateText={handleUpdateTextFields}
        />
      )}

      {showSettingsModal && (
        <div
          class="settings-modal-overlay"
          onClick={() => setShowSettingsModal(false)}
        >
          <div
            class="settings-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="settings-modal-header">
              <h2>Settings</h2>
              <button
                class="close-button"
                onClick={() => setShowSettingsModal(false)}
                title="Close (Esc)"
              >
                ✕
              </button>
            </div>
            <div class="settings-modal-body">
              <Settings
                apiBaseUrl={settings.apiBaseUrl}
                setApiBaseUrl={settings.setApiBaseUrl}
                translationUrl={settings.translationUrl}
                setTranslationUrl={settings.setTranslationUrl}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                models={models}
                fetchModels={fetchModels}
                systemPrompt={settings.systemPrompt}
                setSystemPrompt={settings.setSystemPrompt}
                usePanelDetection={settings.usePanelDetection}
                setUsePanelDetection={settings.setUsePanelDetection}
                streamTranslation={settings.streamTranslation}
                setStreamTranslation={settings.setStreamTranslation}
                enableTwoStepTranslation={settings.enableTwoStepTranslation}
                setEnableTwoStepTranslation={
                  settings.setEnableTwoStepTranslation
                }
                deeplxUrl={settings.deeplxUrl}
                setDeeplxUrl={settings.setDeeplxUrl}
                ocrEngine={settings.ocrEngine}
                setOcrEngine={settings.setOcrEngine}
                showCanvasText={settings.showCanvasText}
                setShowCanvasText={settings.setShowCanvasText}
                deeplOnly={settings.deeplOnly}
                setDeeplOnly={settings.setDeeplOnly}
                deeplTargetLang={settings.deeplTargetLang}
                setDeeplTargetLang={settings.setDeeplTargetLang}
              />
            </div>
          </div>
        </div>
      )}

      <ContextMenu
        x={ctxMenu.x}
        y={ctxMenu.y}
        visible={ctxMenu.visible}
        items={menuItems}
        onClose={closeContextMenu}
      />
    </div>
  );
}
