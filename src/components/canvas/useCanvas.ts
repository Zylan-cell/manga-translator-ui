// src/components/canvas/useCanvas.ts
import { useEffect, useRef, useState } from "preact/hooks";
import { RefObject } from "preact";
import { BoundingBox, DetectedTextItem, TextItem } from "../../types";
import {
  Action,
  CLICK_THRESHOLD,
  getHandleAtPos,
  Handle,
  DEFAULT_BRUSH_SIZE,
} from "../canvas/constants";
import {
  drawOverlay,
  createMaskCanvas,
  drawMaskBrush,
  getMaskDataUrl,
  clearMask,
} from "../canvas/draw";
import { LaidOutTextItem } from "../../hooks/useTextLayout";

const MIN_SIZE = 8;

interface UseCanvasArgs {
  containerRef: RefObject<HTMLDivElement>;
  imageRef: RefObject<HTMLImageElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  detectedItems: LaidOutTextItem[] | null;
  selectedBoxId: number | null;
  editMode: boolean;
  isAdding: boolean;
  onBoxSelect: (item: DetectedTextItem | null) => void;
  onAddBubble: (box: BoundingBox) => void;
  onUpdateBubble: (id: number, box: BoundingBox) => void;
  textItems?: TextItem[] | null;
  maskMode?: boolean;
  eraseMode?: boolean;
  brushSize?: number;
  takeManualMaskSnapshot?: number;
  onMaskSnapshot?: (dataUrl: string | null) => void;
  clearMaskSignal?: number;
  onMaskCleared?: () => void;
  onUndoExternal?: (undo: () => void) => void;
  // Новый токен: если увеличился — не сбрасывать зум/позицию при следующей загрузке изображения
  keepViewportToken?: number;
}

export function useCanvas({
  containerRef,
  imageRef,
  canvasRef,
  detectedItems,
  selectedBoxId,
  editMode,
  isAdding,
  onBoxSelect,
  onAddBubble,
  onUpdateBubble,
  textItems,
  maskMode,
  eraseMode,
  brushSize = DEFAULT_BRUSH_SIZE,
  takeManualMaskSnapshot,
  onMaskSnapshot,
  clearMaskSignal,
  onMaskCleared,
  onUndoExternal,
  keepViewportToken = 0,
}: UseCanvasArgs) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [drawingBox, setDrawingBox] = useState<BoundingBox | null>(null);
  const [maskCanvas, setMaskCanvas] = useState<HTMLCanvasElement | null>(null);
  const [activeInteractionBox, setActiveInteractionBox] =
    useState<BoundingBox | null>(null);

  // Тикер перерисовки маски (мазки/очистка)
  const [maskStrokeTick, setMaskStrokeTick] = useState(0);

  const stateRef = useRef({
    action: null as Action | null,
    startPos: { x: 0, y: 0 },
    lastPos: { x: 0, y: 0 },
    resizeHandle: null as Handle | null,
    currentNewBox: null as BoundingBox | null,
    scale: 1,
    position: { x: 0, y: 0 },
    initialBox: null as BoundingBox | null,
    initialImagePoint: { x: 0, y: 0 },
    clickedOnBubble: false,
    isDrawingMask: false,
    interactionBox: null as BoundingBox | null,
  });

  const activeIdRef = useRef<number | null>(null);

  // Защита от повторного снапшота на один и тот же счетчик
  const manualSnapRef = useRef<number | null>(null);

  // Токен "сохранить вьюпорт" и использованный токен
  const keepViewportTokenRef = useRef<number>(0);
  const usedTokenRef = useRef<number>(0);
  useEffect(() => {
    keepViewportTokenRef.current = keepViewportToken ?? 0;
  }, [keepViewportToken]);

  // Создаём холст маски при смене изображения
  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    const make = () => {
      if (!image.naturalWidth) return;
      const c = createMaskCanvas(image.naturalWidth, image.naturalHeight);
      setMaskCanvas(c);
      setMaskStrokeTick((t) => t + 1);
    };
    if (image.complete && image.naturalWidth > 0) make();
    else image.addEventListener("load", make, { once: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageRef.current?.src]);

  // Снимок маски (Inpaint Manual)
  useEffect(() => {
    if (!maskCanvas || !takeManualMaskSnapshot) return;
    if (manualSnapRef.current === takeManualMaskSnapshot) return;
    manualSnapRef.current = takeManualMaskSnapshot;
    onMaskSnapshot?.(getMaskDataUrl(maskCanvas));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [takeManualMaskSnapshot, maskCanvas]);

  // Очистка маски
  useEffect(() => {
    if (clearMaskSignal && maskCanvas) {
      clearMask(maskCanvas);
      onMaskCleared?.();
      setMaskStrokeTick((t) => t + 1);
    }
  }, [clearMaskSignal, maskCanvas, onMaskCleared]);

  // Undo внешний
  const undoStackRef = useRef<{ id: number; prev: BoundingBox }[]>([]);
  useEffect(() => {
    if (onUndoExternal) {
      onUndoExternal(() => {
        const snap = undoStackRef.current.pop();
        if (snap) onUpdateBubble(snap.id, snap.prev);
      });
    }
  }, [onUndoExternal, onUpdateBubble]);

  // Актуальные scale/position в рефе
  useEffect(() => {
    stateRef.current.scale = scale;
    stateRef.current.position = position;
  }, [scale, position]);

  // Отрисовка оверлея
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const image = imageRef.current;
    if (!canvas || !container || !image) return;

    const itemsToDraw =
      activeInteractionBox && activeIdRef.current
        ? (detectedItems || []).map((item) =>
            item.id === activeIdRef.current
              ? { ...item, box: activeInteractionBox }
              : item
          )
        : detectedItems;

    drawOverlay(canvas, container, image, {
      position,
      scale,
      detectedItems: itemsToDraw,
      selectedBoxId,
      editMode,
      drawingBox,
      maskCanvas,
      maskMode,
      textItems,
      brushSize,
      eraseMode,
    });
  }, [
    position,
    scale,
    detectedItems,
    selectedBoxId,
    editMode,
    drawingBox,
    maskCanvas,
    maskMode,
    textItems,
    brushSize,
    eraseMode,
    activeInteractionBox,
    maskStrokeTick, // важен для немедленной перерисовки маски
    canvasRef,
    containerRef,
    imageRef,
  ]);

  // Сброс/сохранение вьюпорта при загрузке изображения
  useEffect(() => {
    const img = imageRef.current;
    if (!img) return;

    const onLoad = () => {
      // Если прилетел новый токен — сохраняем текущий вьюпорт (не сбрасываем)
      if (keepViewportTokenRef.current > usedTokenRef.current) {
        usedTokenRef.current = keepViewportTokenRef.current;
        return;
      }
      // Обычная загрузка — сбросить
      setScale(1);
      setPosition({ x: 0, y: 0 });
    };

    if (img.complete && img.naturalWidth > 0) onLoad();
    else img.addEventListener("load", onLoad, { once: true });
    return () => img.removeEventListener("load", onLoad);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageRef.current?.src]);

  const screenToImage = (sx: number, sy: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const s = stateRef.current.scale;
    const p = stateRef.current.position;
    return { x: (sx - rect.left - p.x) / s, y: (sy - rect.top - p.y) / s };
  };

  const hitTest = (x: number, y: number): LaidOutTextItem | undefined => {
    return [...(detectedItems || [])]
      .reverse()
      .find(
        (i) => x >= i.box.x1 && x <= i.box.x2 && y >= i.box.y1 && y <= i.box.y2
      );
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ---------- ЛКМ/ПКМ логика (без панорамирования) ----------
    const onPointerDownLMB = (sx: number, sy: number) => {
      stateRef.current.startPos = { x: sx, y: sy };
      stateRef.current.lastPos = { x: sx, y: sy };
      const ip = screenToImage(sx, sy);

      // Mask Mode — ЛКМ рисует
      if (maskMode && maskCanvas) {
        stateRef.current.action = "masking";
        stateRef.current.isDrawingMask = true;
        drawMaskBrush(maskCanvas, ip.x, ip.y, brushSize, !!eraseMode);
        setMaskStrokeTick((t) => t + 1);
        return;
      }

      // Добавление
      if (editMode && isAdding) {
        stateRef.current.action = "drawing";
        const nb: BoundingBox = { x1: ip.x, y1: ip.y, x2: ip.x, y2: ip.y };
        stateRef.current.currentNewBox = nb;
        setDrawingBox(nb);
        activeIdRef.current = null;
        stateRef.current.clickedOnBubble = false;
        return;
      }

      // Редактирование: ресайз/движение/выбор
      if (editMode) {
        const sel = (detectedItems || []).find((i) => i.id === selectedBoxId);
        if (sel) {
          const handle = getHandleAtPos(
            ip.x,
            ip.y,
            sel.box,
            stateRef.current.scale
          );
          if (handle) {
            undoStackRef.current.push({ id: sel.id, prev: { ...sel.box } });
            stateRef.current.action = "resizing";
            stateRef.current.resizeHandle = handle;
            stateRef.current.initialBox = { ...sel.box };
            activeIdRef.current = sel.id;
            stateRef.current.clickedOnBubble = true;
            return;
          }
        }

        const hit = hitTest(ip.x, ip.y);
        if (hit) {
          undoStackRef.current.push({ id: hit.id, prev: { ...hit.box } });
          activeIdRef.current = hit.id;
          onBoxSelect(hit);
          stateRef.current.initialBox = { ...hit.box };
          stateRef.current.initialImagePoint = ip;
          stateRef.current.action = "moving";
          stateRef.current.clickedOnBubble = true;
          return;
        }
      }

      // ЛКМ по пустому — снять выделение, не панорамировать
      onBoxSelect(null);
      stateRef.current.action = null;
      stateRef.current.clickedOnBubble = false;
    };

    const onPointerMoveAny = (sx: number, sy: number) => {
      const dx = sx - stateRef.current.lastPos.x;
      const dy = sy - stateRef.current.lastPos.y;
      stateRef.current.lastPos = { x: sx, y: sy };
      const ip = screenToImage(sx, sy);

      switch (stateRef.current.action) {
        case "masking":
          if (maskCanvas && stateRef.current.isDrawingMask) {
            drawMaskBrush(maskCanvas, ip.x, ip.y, brushSize, !!eraseMode);
            setMaskStrokeTick((t) => t + 1);
          }
          break;

        case "drawing": {
          const s = screenToImage(
            stateRef.current.startPos.x,
            stateRef.current.startPos.y
          );
          const nb: BoundingBox = {
            x1: Math.min(s.x, ip.x),
            y1: Math.min(s.y, ip.y),
            x2: Math.max(s.x, ip.x),
            y2: Math.max(s.y, ip.y),
          };
          stateRef.current.currentNewBox = nb;
          setDrawingBox(nb);
          break;
        }

        case "moving": {
          const initialBox = stateRef.current.initialBox;
          const initialPoint = stateRef.current.initialImagePoint;
          if (!initialBox) break;
          const offsetX = ip.x - initialPoint.x;
          const offsetY = ip.y - initialPoint.y;
          const nb: BoundingBox = {
            x1: initialBox.x1 + offsetX,
            y1: initialBox.y1 + offsetY,
            x2: initialBox.x2 + offsetX,
            y2: initialBox.y2 + offsetY,
          };
          stateRef.current.interactionBox = nb;
          setActiveInteractionBox(nb);
          break;
        }

        case "resizing": {
          const handle = stateRef.current.resizeHandle;
          const init = stateRef.current.initialBox;
          if (!handle || !init) break;

          let { x1, y1, x2, y2 } = init;

          switch (handle) {
            case "topLeft":
              x1 = Math.min(ip.x, x2 - MIN_SIZE);
              y1 = Math.min(ip.y, y2 - MIN_SIZE);
              break;
            case "topRight":
              x2 = Math.max(ip.x, x1 + MIN_SIZE);
              y1 = Math.min(ip.y, y2 - MIN_SIZE);
              break;
            case "bottomLeft":
              x1 = Math.min(ip.x, x2 - MIN_SIZE);
              y2 = Math.max(ip.y, y1 + MIN_SIZE);
              break;
            case "bottomRight":
              x2 = Math.max(ip.x, x1 + MIN_SIZE);
              y2 = Math.max(ip.y, y1 + MIN_SIZE);
              break;
            case "left":
              x1 = Math.min(ip.x, x2 - MIN_SIZE);
              break;
            case "right":
              x2 = Math.max(ip.x, x1 + MIN_SIZE);
              break;
            case "top":
              y1 = Math.min(ip.y, y2 - MIN_SIZE);
              break;
            case "bottom":
              y2 = Math.max(ip.y, y1 + MIN_SIZE);
              break;
          }

          const nb: BoundingBox = {
            x1: Math.min(x1, x2),
            y1: Math.min(y1, y2),
            x2: Math.max(x1, x2),
            y2: Math.max(y1, y2),
          };
          stateRef.current.interactionBox = nb;
          setActiveInteractionBox(nb);
          break;
        }
      }
    };

    const onPointerUpAny = (sx: number, sy: number) => {
      const dist = Math.hypot(
        sx - stateRef.current.startPos.x,
        sy - stateRef.current.startPos.y
      );

      if (stateRef.current.action === "masking") {
        stateRef.current.isDrawingMask = false;
      }

      if (
        stateRef.current.action === "panning" &&
        dist < CLICK_THRESHOLD &&
        !stateRef.current.clickedOnBubble
      ) {
        onBoxSelect(null);
      }

      if (stateRef.current.action === "drawing") {
        const nb = stateRef.current.currentNewBox;
        if (nb && nb.x2 - nb.x1 >= MIN_SIZE && nb.y2 - nb.y1 >= MIN_SIZE) {
          onAddBubble(nb);
        }
      }

      if (
        (stateRef.current.action === "moving" ||
          stateRef.current.action === "resizing") &&
        stateRef.current.interactionBox &&
        activeIdRef.current
      ) {
        onUpdateBubble(activeIdRef.current, stateRef.current.interactionBox);
      }

      stateRef.current.action = null;
      stateRef.current.currentNewBox = null;
      stateRef.current.initialBox = null;
      stateRef.current.initialImagePoint = { x: 0, y: 0 };
      stateRef.current.clickedOnBubble = false;
      stateRef.current.isDrawingMask = false;
      stateRef.current.interactionBox = null;
      setDrawingBox(null);
      setActiveInteractionBox(null);
      activeIdRef.current = null;
    };

    // Блокируем нативный auxclick по СКМ (автоскролл в WebView2)
    const onAuxClick = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // ЛКМ / ПКМ
    const onMouseDown = (e: MouseEvent) => {
      // ЛКМ
      if (e.button === 0) {
        e.preventDefault();
        onPointerDownLMB(e.clientX, e.clientY);
        const mm = (ev: MouseEvent) => onPointerMoveAny(ev.clientX, ev.clientY);
        const mu = (ev: MouseEvent) => {
          window.removeEventListener("mousemove", mm);
          window.removeEventListener("mouseup", mu);
          onPointerUpAny(ev.clientX, ev.clientY);
        };
        window.addEventListener("mousemove", mm);
        window.addEventListener("mouseup", mu);
        return;
      }

      // СКМ обрабатываем через pointer events (ниже)
      if (e.button === 1) {
        e.preventDefault();
        return;
      }

      // ПКМ — стирание в маске
      if (e.button === 2 && maskMode && maskCanvas) {
        e.preventDefault();
        const ip = screenToImage(e.clientX, e.clientY);
        stateRef.current.action = "masking";
        stateRef.current.isDrawingMask = true;
        drawMaskBrush(maskCanvas, ip.x, ip.y, brushSize, true);
        setMaskStrokeTick((t) => t + 1);

        const mm = (ev: MouseEvent) => {
          const ip2 = screenToImage(ev.clientX, ev.clientY);
          if (stateRef.current.isDrawingMask) {
            drawMaskBrush(maskCanvas, ip2.x, ip2.y, brushSize, true);
            setMaskStrokeTick((t) => t + 1);
          }
        };
        const mu = () => {
          window.removeEventListener("mousemove", mm);
          window.removeEventListener("mouseup", mu);
          stateRef.current.action = null;
          stateRef.current.isDrawingMask = false;
        };
        window.addEventListener("mousemove", mm);
        window.addEventListener("mouseup", mu);
      }
    };

    // Зум колесом
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const ps = stateRef.current.scale;
      const ns = Math.max(0.1, Math.min(ps * (1 - e.deltaY * 0.001), 10));
      const pp = stateRef.current.position;
      const wx = (mx - pp.x) / ps;
      const wy = (my - pp.y) / ps;
      setPosition({ x: mx - wx * ns, y: my - wy * ns });
      setScale(ns);
    };

    // Контекстное меню в маске — отключить
    const onContextMenu = (e: MouseEvent) => {
      if (maskMode) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // ---------- СКМ панорамирование через Pointer Events с pointer capture ----------
    const pDown = (e: PointerEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      try {
        (container as HTMLDivElement).setPointerCapture(e.pointerId);
      } catch {}
      stateRef.current.action = "panning";
      stateRef.current.lastPos = { x: e.clientX, y: e.clientY };
      try {
        container.style.cursor = "grabbing";
      } catch {}
    };

    const pMove = (e: PointerEvent) => {
      if (stateRef.current.action !== "panning") return;
      const dx = e.clientX - stateRef.current.lastPos.x;
      const dy = e.clientY - stateRef.current.lastPos.y;
      stateRef.current.lastPos = { x: e.clientX, y: e.clientY };
      setPosition((pos) => ({ x: pos.x + dx, y: pos.y + dy }));
    };

    const pUp = (e: PointerEvent) => {
      if (e.button !== 1) return;
      try {
        if ((container as HTMLDivElement).hasPointerCapture(e.pointerId)) {
          (container as HTMLDivElement).releasePointerCapture(e.pointerId);
        }
      } catch {}
      stateRef.current.action = null;
      try {
        container.style.cursor = maskMode ? "crosshair" : "grab";
      } catch {}
    };

    container.addEventListener("mousedown", onMouseDown);
    container.addEventListener("wheel", onWheel, { passive: false });
    container.addEventListener("contextmenu", onContextMenu);
    container.addEventListener("auxclick", onAuxClick);
    container.addEventListener("pointerdown", pDown);
    container.addEventListener("pointermove", pMove);
    container.addEventListener("pointerup", pUp);

    return () => {
      container.removeEventListener("mousedown", onMouseDown);
      container.removeEventListener("wheel", onWheel as any);
      container.removeEventListener("contextmenu", onContextMenu);
      container.removeEventListener("auxclick", onAuxClick);
      container.removeEventListener("pointerdown", pDown);
      container.removeEventListener("pointermove", pMove);
      container.removeEventListener("pointerup", pUp);
    };
  }, [
    detectedItems,
    selectedBoxId,
    editMode,
    isAdding,
    maskMode,
    maskCanvas,
    brushSize,
    eraseMode,
    onBoxSelect,
    onAddBubble,
    onUpdateBubble,
    containerRef,
  ]);

  return { scale, position };
}
