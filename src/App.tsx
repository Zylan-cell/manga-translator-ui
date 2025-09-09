// src/App.tsx
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";

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
  const [batchActive, setBatchActive] = useState(false);

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
  } = useImageLibrary(setProgress, batchActive);

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
  const { translateAllBubbles, retranslateFromCache } = useTranslation({
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
    onStreamUpdate: () => {}, // лог стрима не показываем
    onStreamEnd: () => {},
    deeplTargetLang: settings.deeplTargetLang,
  });

  // Авто-ретрансляция из кэша только при смене целевого языка
  useEffect(() => {
    if (!detectedItems) return;
    if (detectedItems.some((item) => item.cachedIntermediateText)) {
      retranslateFromCache(settings.deeplTargetLang);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.deeplTargetLang]);

  const { processCurrentAll, processAllImagesAll } = useProcessAll({
    apiBaseUrl: settings.apiBaseUrl,
    usePanelDetection: settings.usePanelDetection,
    translationUrl: settings.translationUrl,
    selectedModel,
    systemPrompt: settings.systemPrompt,
    enableTwoStepTranslation: settings.enableTwoStepTranslation,
    deeplxUrl: settings.deeplxUrl,
    deeplxApiKey: settings.deeplxApiKey,
    deeplTargetLang: settings.deeplTargetLang,
    setDetectedItems,
    setImageList,
    setProgress,
    setBatchActive,
  });

  const onImageLoaded = useCallback(
    (dataUrl: string) => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const imageName = `dropped-image-${timestamp}.png`;

      const newImageInfo = {
        name: imageName,
        path: `temp://${imageName}`,
        dataUrl: dataUrl,
        thumbnail: dataUrl,
        items: [] as DetectedTextItem[],
      };

      setImageList((prev) => {
        const newList = [...prev, newImageInfo];
        const newIndex = newList.length - 1;

        setTimeout(() => {
          setCurrentImageIndex(newIndex);
        }, 0);

        return newList;
      });

      setImageSrc(dataUrl);
      setDetectedItems([]);
      setSelectedBoxId(null);
    },
    [setImageSrc, setImageList, setCurrentImageIndex]
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
          cachedIntermediateText: null,
          cachedIntermediateLang: null,
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

  const handleExportProject = useCallback(async () => {
    if (!imageList.length) {
      alert("No images to export");
      return;
    }

    try {
      const projectData = {
        metadata: {
          version: "1",
        },
        images: imageList.map((img) => ({
          name: img.name,
          items: (img.items || []).map((item) => ({
            box: {
              x1: item.box.x1,
              y1: item.box.y1,
              x2: item.box.x2,
              y2: item.box.y2,
            },
            ocrText: item.ocrText,
            translation: item.translation,
            cachedIntermediateText: item.cachedIntermediateText || null,
            cachedIntermediateLang: item.cachedIntermediateLang || null,
          })),
        })),
        settings: {
          deeplTargetLang: settings.deeplTargetLang,
          ocrEngine: settings.ocrEngine,
          cachedIntermediateLang: settings.enableTwoStepTranslation
            ? "EN"
            : null,
        },
      };

      // Prepare image data including base64 for temp:// paths
      const imageData = imageList.map((img) => {
        return {
          path: img.path,
          dataUrl: img.dataUrl, // Always include dataUrl for all images
          name: img.name,
        };
      });

      await invoke("export_project", {
        projectData,
        imageData,
      });

      alert("Project exported successfully!");
    } catch (error) {
      console.error("Export failed:", error);
      alert(`Export failed: ${error}`);
    }
  }, [imageList, settings]);

  const handleImportProject = useCallback(async () => {
    try {
      const projectData = await invoke("import_project");
      if (projectData) {
        const data = projectData as any;

        const images = data.images || [];
        const projectSettings = data.settings || {};

        const processedImages = images.map((img: any) => ({
          name: img.name,
          path: img.path || `imported/${img.name}`,
          dataUrl: img.dataUrl,
          thumbnail: img.thumbnail || img.dataUrl,
          items: (img.items || []).map((item: any, itemIndex: number) => ({
            id: itemIndex + 1, // Reassign sequential IDs
            box: item.box,
            ocrText: item.ocrText,
            translation: item.translation,
            cachedIntermediateText: item.cachedIntermediateText || null,
            cachedIntermediateLang: item.cachedIntermediateLang || null,
            textProperties: item.textProperties || {
              fontFamily: "Arial",
              fontSize: 16,
              fontWeight: "normal",
              fontStyle: "normal",
              textDecoration: "none",
              color: "#000",
              strokeColor: "#FFF",
              strokeWidth: 2,
            },
          })),
        }));

        setImageList(processedImages);
        if (processedImages.length > 0) {
          setCurrentImageIndex(0);
          setImageSrc(processedImages[0].dataUrl);
          setDetectedItems(processedImages[0].items || []);
        }

        if (projectSettings.deeplTargetLang) {
          settings.setDeeplTargetLang(projectSettings.deeplTargetLang);
        }
        if (
          projectSettings.cachedIntermediateLang &&
          projectSettings.cachedIntermediateLang === "EN"
        ) {
          settings.setEnableTwoStepTranslation(true);
        }

        alert("Project imported successfully!");
      }
    } catch (error) {
      console.error("Import failed:", error);
      alert(`Import failed: ${error}`);
    }
  }, [
    setImageList,
    setCurrentImageIndex,
    setImageSrc,
    setDetectedItems,
    settings,
  ]);

  const handleBoxSelect = useCallback(
    (itemOrId: DetectedTextItem | null) => {
      if (isAddingBubble) return;
      const id = itemOrId?.id ?? null;
      setSelectedBoxId(id);
      if (id !== null) setShowFloatingWindow(true);
    },
    [isAddingBubble]
  );

  // Контекстное меню рабочего поля
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
      processAllImagesAll: () => processAllImagesAll(imageList),
      handleExportProject,
      handleImportProject,
    });

  // Удаление одного изображения и очистка списка
  const handleRemoveImageAt = useCallback(
    (idx: number) => {
      setImageList((prev) => {
        if (idx < 0 || idx >= prev.length) return prev;
        const next = [...prev];
        next.splice(idx, 1);

        if (prev.length === 1) {
          setCurrentImageIndex(0);
          setImageSrc(null);
          setDetectedItems(null);
          return next;
        }

        if (idx === currentImageIndex) {
          const newIndex = Math.min(idx, next.length - 1);
          setCurrentImageIndex(newIndex);
          setTimeout(() => loadImageByIndex(newIndex), 0);
        } else if (idx < currentImageIndex) {
          setCurrentImageIndex((i) => Math.max(0, i - 1));
        }
        return next;
      });
    },
    [
      currentImageIndex,
      loadImageByIndex,
      setImageList,
      setCurrentImageIndex,
      setImageSrc,
      setDetectedItems,
    ]
  );

  const handleClearAllImages = useCallback(() => {
    setImageList([]);
    setCurrentImageIndex(0);
    setImageSrc(null);
    setDetectedItems(null);
  }, [setImageList, setCurrentImageIndex, setImageSrc, setDetectedItems]);

  return (
    <div class="app-root">
      <div class="app-container">
        <AppHeader
          onImportImages={handleImportImages}
          onShowSettings={() => setShowSettingsModal(true)}
          onExportProject={handleExportProject}
          onImportProject={handleImportProject}
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
              onRemoveAt={handleRemoveImageAt}
              onClearAll={handleClearAllImages}
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

      <ContextMenu
        x={ctxMenu.x}
        y={ctxMenu.y}
        visible={ctxMenu.visible}
        items={menuItems}
        onClose={closeContextMenu}
      />

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
                deeplTargetLang={settings.deeplTargetLang}
                setDeeplTargetLang={settings.setDeeplTargetLang}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
