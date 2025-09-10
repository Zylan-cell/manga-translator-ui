// src/App.tsx
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";

import LeftMenuBar from "./components/ui/LeftMenuBar";
import CombinedRightPanel from "./components/ui/CombinedRightPanel";
import BottomToolbar from "./components/ui/BottomToolbar";
import ImageCanvas from "./components/ui/ImageCanvas";
import Settings from "./components/ui/Settings";
import ImageList from "./components/ui/ImageList";
import ContextMenu from "./components/ui/ContextMenu";
import TopProgressBar from "./components/ui/TopProgressBar";

import {
  DetectedTextItem,
  LoadingState,
  BoundingBox,
  DEFAULT_TEXT_PROPERTIES,
} from "./types";
import { useDetection } from "./hooks/useDetection";
import { useOcr } from "./hooks/useOcr";
import { useTranslation } from "./hooks/useTranslation";
import { useHotkeys } from "./hooks/useHotkeys";
import { useModels } from "./hooks/useModels";
import { useTextLayout } from "./hooks/useTextLayout";

import { useSettingsState } from "./hooks/useSettingsState";
import { useImageLibrary } from "./hooks/useImageLibrary";
import { useDnDImport } from "./hooks/useDnDImport";
import { useContextMenu } from "./hooks/useContextMenu";
import { useInpainting } from "./hooks/useInpainting";
import { ProgressState } from "./types/ui";
import { DEFAULT_BRUSH_SIZE } from "./components/canvas/constants";

// Отрисовать финальное изображение (инпейнт уже в dataUrl) + текст с учётом настроек
async function renderFinalImage(
  baseDataUrl: string,
  items: DetectedTextItem[] | null
): Promise<string> {
  if (!baseDataUrl) return "";
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("Load image error"));
    im.src = baseDataUrl;
  });
  const W = img.naturalWidth || img.width;
  const H = img.naturalHeight || img.height;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  if (!items?.length) return c.toDataURL("image/png");

  for (const it of items) {
    if (!it.translation) continue;
    const tp = it.textProperties || DEFAULT_TEXT_PROPERTIES;

    // Подготовка шрифта
    const padding = 4;
    const fontSize = tp.fontSize;
    const lineHeight = Math.ceil(fontSize * 1.2);
    ctx.font = `${tp.fontStyle} ${tp.fontWeight} ${fontSize}px "${tp.fontFamily}", sans-serif`;
    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    ctx.fillStyle = tp.color;
    ctx.strokeStyle = tp.strokeColor;
    ctx.lineWidth = tp.strokeWidth;

    // Перенос строк по ширине бокса
    const maxW = Math.max(8, it.box.x2 - it.box.x1 - padding * 2);
    const words = it.translation.split(/\s+/);
    const lines: string[] = [];
    let line = words[0] || "";
    for (let i = 1; i < words.length; i++) {
      const test = line + " " + words[i];
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);

    // Центрирование по вертикали
    const maxH = Math.max(8, it.box.y2 - it.box.y1 - padding * 2);
    const totalH = lines.length * lineHeight;
    const startY = it.box.y1 + padding + Math.max(0, (maxH - totalH) / 2);
    const centerX = it.box.x1 + padding + maxW / 2;

    // Рисуем строки + underline
    for (let i = 0; i < lines.length; i++) {
      const y = startY + i * lineHeight;
      if (tp.strokeWidth > 0) ctx.strokeText(lines[i], centerX, y);
      ctx.fillText(lines[i], centerX, y);

      if (tp.textDecoration === "underline") {
        const m = ctx.measureText(lines[i]);
        const underY = y + fontSize + Math.max(1, tp.strokeWidth / 2);
        const half = m.width / 2;
        ctx.save();
        ctx.lineWidth = Math.max(1, tp.strokeWidth);
        ctx.strokeStyle = tp.color;
        ctx.beginPath();
        ctx.moveTo(centerX - half, underY);
        ctx.lineTo(centerX + half, underY);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  return c.toDataURL("image/png");
}

export default function App() {
  const [detectedItems, setDetectedItems] = useState<DetectedTextItem[] | null>(
    null
  );
  const [selectedBoxId, setSelectedBoxId] = useState<number | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const editMode = true;
  const [isAddingBubble, setAddingBubble] = useState(false);

  const [maskMode, setMaskMode] = useState(false);
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);
  const [maskSnapshot, setMaskSnapshot] = useState(0);
  const [clearMask, setClearMask] = useState(0);
  const [isLoadingState, setIsLoading] = useState<LoadingState>({
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
  const [keepViewportTick, setKeepViewportTick] = useState(0);

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
    handleImportFolder,
    selectImageAt,
  } = useImageLibrary(setProgress, false);

  const updateDetectedItems = useCallback(
    (
      updater: (prev: DetectedTextItem[] | null) => DetectedTextItem[] | null
    ) => {
      setDetectedItems(updater);
      setImageList((prevList) => {
        const newList = [...prevList];
        const currentImage = newList[currentImageIndex];
        if (currentImage) {
          const newItems = updater(currentImage.items ?? null);
          newList[currentImageIndex] = { ...currentImage, items: newItems };
        }
        return newList;
      });
    },
    [currentImageIndex, setImageList]
  );

  useEffect(() => {
    const cur = imageList[currentImageIndex];
    setDetectedItems(cur?.items ?? null);
  }, [currentImageIndex, imageList]);

  const handleSelectImage = (index: number) => {
    if (index === currentImageIndex) return;
    selectImageAt(index);
    setSelectedBoxId(null);
  };

  const itemsForCanvas = useTextLayout(
    settings.showCanvasText ? detectedItems : null
  );

  const { handleDetect } = useDetection({
    imageSrc,
    apiBaseUrl: settings.apiBaseUrl,
    setDetectedItems: updateDetectedItems,
    setIsLoading,
    usePanelDetection: settings.usePanelDetection,
    detectionModel: settings.detectionModel,
  });

  const { recognizeAllBubbles } = useOcr({
    imageSrc,
    detectedItems,
    editMode,
    apiBaseUrl: settings.apiBaseUrl,
    setDetectedItems: updateDetectedItems,
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
    setDetectedItems: updateDetectedItems,
    setIsLoading,
    onStreamUpdate: () => {},
    onStreamEnd: () => {},
    deeplTargetLang: settings.deeplTargetLang,
  });

  useEffect(() => {
    if (isLoadingState.translate) return;
    if (detectedItems?.some((item) => item.cachedIntermediateText)) {
      retranslateFromCache(settings.deeplTargetLang);
    }
  }, [
    settings.deeplTargetLang,
    retranslateFromCache,
    detectedItems,
    isLoadingState.translate,
  ]);

  const handleImageUpdate = useCallback(
    (newImageSrc: string) => {
      // Не сбрасывать вьюпорт на следующую загрузку
      setKeepViewportTick((t) => t + 1);
      setImageSrc(newImageSrc);
      setImageList((prev) => {
        const newList = [...prev];
        if (newList[currentImageIndex]) {
          newList[currentImageIndex] = {
            ...newList[currentImageIndex],
            dataUrl: newImageSrc,
            thumbnail: newImageSrc,
          };
        }
        return newList;
      });
    },
    [currentImageIndex, setImageSrc, setImageList]
  );

  const { isInpainting, inpaintAuto, inpaintManual } = useInpainting({
    imageSrc,
    apiBaseUrl: settings.apiBaseUrl,
    selectedBubbleId: selectedBoxId,
    detectedItems,
    onImageUpdate: handleImageUpdate,
    onProgress: (p) => setProgress((prev) => ({ ...prev, ...p })),
  });

  const isLoading = { ...isLoadingState, inpainting: isInpainting };

  const handleInpaintManual = useCallback(
    async (maskDataUrl: string) => {
      if (isInpainting) return;
      await inpaintManual(
        maskDataUrl,
        settings.inpaintModel || "lama_large_512px"
      );
    },
    [isInpainting, inpaintManual, settings.inpaintModel]
  );

  // Снимок маски -> сохранить в текущем ImageInfo -> запустить инпейнт -> очистить маску
  const handleMaskSnapshot = useCallback(
    async (dataUrl: string | null) => {
      if (!dataUrl) return;
      setImageList((prev) => {
        const next = [...prev];
        const cur = next[currentImageIndex];
        if (cur) next[currentImageIndex] = { ...cur, maskDataUrl: dataUrl };
        return next;
      });
      await handleInpaintManual(dataUrl);
      setClearMask((p) => p + 1);
      // по желанию: автоматический выход из maskMode
      // setMaskMode(false);
    },
    [currentImageIndex, setImageList, handleInpaintManual]
  );

  const onImageLoaded = useCallback(
    (dataUrl: string) => {
      const imageName = `dropped-image-${Date.now()}.png`;
      const newImageInfo = {
        name: imageName,
        path: `temp://${imageName}`,
        dataUrl,
        thumbnail: dataUrl,
        items: [],
        maskDataUrl: null as string | null,
      };
      setImageList((prev) => {
        const newList = [...prev, newImageInfo];
        // Автоматически выбрать только что добавленное
        setTimeout(() => {
          handleSelectImage(newList.length - 1);
        }, 0);
        return newList;
      });
      setImageSrc(dataUrl);
      setDetectedItems([]);
    },
    [setImageSrc, setImageList, handleSelectImage]
  );

  useDnDImport(onImageLoaded);

  const handleUpdateTextFields = useCallback(
    (id: number, fields: Partial<DetectedTextItem>) => {
      updateDetectedItems((prev) =>
        prev
          ? prev.map((it) => (it.id === id ? { ...it, ...fields } : it))
          : prev
      );
    },
    [updateDetectedItems]
  );

  const handleAddBubble = useCallback(
    (newBox: BoundingBox) => {
      updateDetectedItems((prev) => {
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
            textProperties: DEFAULT_TEXT_PROPERTIES,
          },
        ];
      });
      setAddingBubble(false);
    },
    [updateDetectedItems]
  );

  const handleUpdateBubble = useCallback(
    (id: number, newBox: BoundingBox) => {
      updateDetectedItems((prev) =>
        prev
          ? prev.map((it) => (it.id === id ? { ...it, box: newBox } : it))
          : null
      );
    },
    [updateDetectedItems]
  );

  const handleDeleteBubble = useCallback(() => {
    if (selectedBoxId === null) return;
    updateDetectedItems((prev) =>
      prev
        ? prev
            .filter((it) => it.id !== selectedBoxId)
            .map((it, idx) => ({ ...it, id: idx + 1 }))
        : null
    );
    setSelectedBoxId(null);
  }, [selectedBoxId, updateDetectedItems]);

  const handleReorder = useCallback(
    (sourceId: number, targetId: number) => {
      updateDetectedItems((prev) => {
        if (!prev) return null;
        const items = [...prev];
        const from = items.findIndex((i) => i.id === sourceId);
        const to =
          targetId === -1
            ? items.length
            : items.findIndex((i) => i.id === targetId);
        if (from === -1 || to === -1) return items;
        const [moved] = items.splice(from, 1);
        items.splice(from < to ? to - 1 : to, 0, moved);
        return items.map((it, idx) => ({ ...it, id: idx + 1 }));
      });
    },
    [updateDetectedItems]
  );

  const toggleMaskMode = useCallback(() => {
    if (imageSrc) setMaskMode((p) => !p);
  }, [imageSrc]);

  const handleClearMask = useCallback(() => setClearMask((p) => p + 1), []);

  const handleInpaintAuto = useCallback(() => {
    if (selectedBoxId && !isInpainting) inpaintAuto();
  }, [selectedBoxId, isInpainting, inpaintAuto]);

  const toggleAddBubble = useCallback(() => {
    if (imageSrc) setAddingBubble((p) => !p);
  }, [imageSrc]);

  // Экспорт изображений (финалов)
  const handleExportImages = useCallback(async () => {
    if (!imageList.length) {
      alert("No images to export");
      return;
    }
    try {
      setProgress({
        active: true,
        current: 0,
        total: imageList.length,
        label: "Exporting images...",
      });

      const finals = [];
      for (let i = 0; i < imageList.length; i++) {
        const img = imageList[i];
        const dataUrl = await renderFinalImage(img.dataUrl, img.items || []);
        finals.push({ name: img.name, dataUrl });
        setProgress({
          active: true,
          current: i + 1,
          total: imageList.length,
          label: "Exporting images...",
        });
      }

      await invoke("export_flattened_images", { images: finals });
      alert("Images exported successfully!");
    } catch (e) {
      console.error(e);
      alert(`Export images failed: ${e}`);
    } finally {
      setProgress({ active: false, current: 0, total: 0, label: "" });
    }
  }, [imageList, setProgress]);

  // Экспорт проекта v2 (без финалов)
  const handleExportProject = useCallback(async () => {
    if (!imageList.length) return alert("No images to export");
    try {
      const projectData = {
        metadata: { version: "2" }, // v2
        images: imageList.map((img) => ({
          name: img.name,
          items: (img.items || []).map((item) => ({
            box: item.box,
            ocrText: item.ocrText,
            translation: item.translation,
            cachedIntermediateText: item.cachedIntermediateText || null,
            cachedIntermediateLang: item.cachedIntermediateLang || null,
            textProperties: item.textProperties || DEFAULT_TEXT_PROPERTIES,
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
      const imageData = imageList.map((img) => ({
        path: img.path,
        dataUrl: img.dataUrl,
        name: img.name,
        maskDataUrl: img.maskDataUrl || null,
      }));
      await invoke("export_project", { projectData, imageData });
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
        const images = (data.images || []).map((img: any) => ({
          ...img,
          items: (img.items || []).map((item: any, idx: number) => ({
            ...item,
            id: idx + 1,
          })),
        }));
        setImageList(images);
        if (images.length > 0) {
          setCurrentImageIndex(0);
          setImageSrc(images[0].dataUrl);
          setDetectedItems(images[0].items || []);
        }
        if (data.settings?.deeplTargetLang)
          settings.setDeeplTargetLang(data.settings.deeplTargetLang);
        if (data.settings?.cachedIntermediateLang === "EN")
          settings.setEnableTwoStepTranslation(true);
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
    (item: DetectedTextItem | null) => {
      if (isAddingBubble) return;
      setSelectedBoxId(item?.id ?? null);
    },
    [isAddingBubble]
  );

  useHotkeys({
    editMode,
    isAddingBubble,
    showSettingsModal,
    toggleAddBubble,
    handleDeleteBubble,
    handleDetect,
    recognizeAllBubbles,
    translateAllBubbles,
    cancelAddBubble: () => setAddingBubble(false),
    closeSettings: () => setShowSettingsModal(false),
    onUndo: () => undoRef.current?.(),
  });

  const { ctxMenu, openContextMenu, closeContextMenu, menuItems } =
    useContextMenu({
      imageSrc,
      detectedItems,
      progress,
      handleDetect,
      recognizeAllBubbles,
      translateAllBubbles,
    });

  const handleRemoveImageAt = useCallback(
    (idx: number) => {
      setImageList((prev) => {
        const next = prev.filter((_, i) => i !== idx);
        if (next.length === 0) {
          setImageSrc(null);
          setDetectedItems(null);
          setCurrentImageIndex(0);
        } else if (idx === currentImageIndex) {
          const newIndex = Math.min(idx, next.length - 1);
          handleSelectImage(newIndex);
        } else if (idx < currentImageIndex) {
          setCurrentImageIndex((i) => i - 1);
        }
        return next;
      });
    },
    [
      currentImageIndex,
      handleSelectImage,
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
        <LeftMenuBar
          onImportImages={handleImportImages}
          onImportFolder={handleImportFolder}
          onImportProject={handleImportProject}
          onExportProject={handleExportProject}
          onExportImages={handleExportImages} // NEW
          onShowSettings={() => setShowSettingsModal(true)}
        />
        <TopProgressBar {...progress} />
        <main class="app-main">
          <div className="left-sidebar">
            <ImageList
              images={imageList}
              currentIndex={currentImageIndex}
              onSelect={handleSelectImage}
              onRemoveAt={handleRemoveImageAt}
              onClearAll={handleClearAllImages}
            />
          </div>
          <div class="main-workspace" onContextMenu={openContextMenu}>
            {/* @ts-ignore pass keepViewportToken to ImageCanvas (updated to support it) */}
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
              maskMode={maskMode}
              brushSize={brushSize}
              takeManualMaskSnapshot={maskSnapshot}
              onMaskSnapshot={handleMaskSnapshot}
              clearMaskSignal={clearMask}
              onMaskCleared={() => {}}
              keepViewportToken={keepViewportTick}
            />
          </div>
          <CombinedRightPanel
            detectedItems={detectedItems}
            selectedBoxId={selectedBoxId}
            onBoxSelect={handleBoxSelect}
            editMode={editMode}
            onReorder={handleReorder}
            onUpdateTextFields={handleUpdateTextFields}
          />
        </main>
        <BottomToolbar
          imageSrc={imageSrc}
          isLoading={isLoading}
          isAddingBubble={isAddingBubble}
          onToggleAddBubble={toggleAddBubble}
          onDeleteBubble={handleDeleteBubble}
          selectedBubbleId={selectedBoxId}
          maskMode={maskMode}
          onToggleMaskMode={toggleMaskMode}
          onInpaintAuto={handleInpaintAuto}
          onInpaintManual={() => setMaskSnapshot((p) => p + 1)}
          onClearMask={handleClearMask}
          brushSize={brushSize}
          onBrushSizeChange={setBrushSize}
        />
      </div>

      <ContextMenu {...ctxMenu} items={menuItems} onClose={closeContextMenu} />

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
              >
                ✕
              </button>
            </div>
            <div class="settings-modal-body">
              <Settings
                {...settings}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                models={models}
                fetchModels={fetchModels}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
