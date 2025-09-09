import { useEffect, useRef, useState } from "preact/hooks";
import { RefObject } from "preact";
import { BoundingBox, DetectedTextItem, TextItem } from "../../types";
import { Action, CLICK_THRESHOLD, getHandleAtPos, Handle } from "./constants";
import { drawOverlay } from "./draw";
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

  // опциональные — совместимость с ImageCanvas
  textMode?: boolean;
  onAddTextAt?: (x: number, y: number) => void;
  textItems?: TextItem[] | null;

  maskMode?: boolean;
  eraseMode?: boolean;
  brushSize?: number;
  takeManualMaskSnapshot?: number;
  onMaskSnapshot?: (dataUrl: string | null) => void;
  clearMaskSignal?: number;
  onMaskCleared?: () => void;

  onUndoExternal?: (undo: () => void) => void;
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
  onUndoExternal,
}: UseCanvasArgs) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [drawingBox, setDrawingBox] = useState<BoundingBox | null>(null);

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
    clickedOnBubble: false, // ВАЖНО: нужен для выбора без editMode
  });

  const activeIdRef = useRef<number | null>(null);

  const undoStackRef = useRef<{ id: number; prev: BoundingBox }[]>([]);
  useEffect(() => {
    if (!onUndoExternal) return;
    onUndoExternal(() => {
      const snap = undoStackRef.current.pop();
      if (snap) onUpdateBubble(snap.id, snap.prev);
    });
  }, [onUndoExternal, onUpdateBubble]);

  useEffect(() => {
    stateRef.current.scale = scale;
    stateRef.current.position = position;
  }, [scale, position]);

  // Перерисовка
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const image = imageRef.current;
    if (!canvas || !container || !image) return;

    drawOverlay(canvas, container, image, {
      position,
      scale,
      detectedItems: detectedItems || [],
      selectedBoxId,
      editMode,
      drawingBox,
      textItems,
    });
  }, [
    position,
    scale,
    detectedItems,
    selectedBoxId,
    editMode,
    drawingBox,
    textItems,
  ]);

  // Сброс трансформа при загрузке нового изображения
  useEffect(() => {
    const img = imageRef.current;
    if (!img) return;
    const onLoad = () => {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    };
    if (img.complete && img.naturalWidth > 0) onLoad();
    else img.addEventListener("load", onLoad);
    return () => img.removeEventListener("load", onLoad);
  }, [imageRef]);

  const screenToImage = (sx: number, sy: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const s = stateRef.current.scale;
    const p = stateRef.current.position;
    return {
      x: (sx - rect.left - p.x) / s,
      y: (sy - rect.top - p.y) / s,
    };
  };

  // последний сверху
  const hitTest = (x: number, y: number): LaidOutTextItem | undefined => {
    return (detectedItems || [])
      .slice()
      .reverse()
      .find((i) => {
        const { x1, y1, x2, y2 } = i.box;
        return x >= x1 && x <= x2 && y >= y1 && y <= y2;
      });
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onPointerDown = (sx: number, sy: number) => {
      stateRef.current.startPos = { x: sx, y: sy };
      stateRef.current.lastPos = { x: sx, y: sy };

      const ip = screenToImage(sx, sy);

      // РИСОВАНИЕ НОВОГО БОКСА (только в editMode)
      if (editMode && isAdding) {
        stateRef.current.action = "drawing";
        const nb: BoundingBox = {
          x1: ip.x,
          y1: ip.y,
          x2: ip.x,
          y2: ip.y,
        };
        stateRef.current.currentNewBox = nb;
        setDrawingBox(nb);
        activeIdRef.current = null;
        stateRef.current.clickedOnBubble = false;
        return;
      }

      // РЕЖИМ РЕДАКТИРОВАНИЯ: resize/move/выбор
      if (editMode) {
        // 1) пробуем ресайз у уже выбранного
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
            activeIdRef.current = sel.id;
            stateRef.current.clickedOnBubble = true;
            return;
          }
        }

        // 2) иначе — хитаем любой бабл и двигаем
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

        // клик по пустому — панорамирование
        activeIdRef.current = null;
        stateRef.current.action = "panning";
        stateRef.current.clickedOnBubble = false;
        return;
      }

      // НЕ editMode: только выбор бабла (без движения/ресайза) или панорамирование
      const hit = hitTest(ip.x, ip.y);
      if (hit) {
        onBoxSelect(hit);
        stateRef.current.action = null; // не панорамируем при клике по баблу
        stateRef.current.clickedOnBubble = true;
        return;
      }

      // пустое место — панорамирование
      stateRef.current.action = "panning";
      stateRef.current.clickedOnBubble = false;
    };

    const onPointerMove = (sx: number, sy: number) => {
      const dx = sx - stateRef.current.lastPos.x;
      const dy = sy - stateRef.current.lastPos.y;
      stateRef.current.lastPos = { x: sx, y: sy };

      const ip = screenToImage(sx, sy);

      switch (stateRef.current.action) {
        case "panning": {
          setPosition((pos) => ({ x: pos.x + dx, y: pos.y + dy }));
          break;
        }
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
          const id = activeIdRef.current ?? selectedBoxId!;
          if (!id) break;
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
          onUpdateBubble(id, nb);
          break;
        }
        case "resizing": {
          const id = activeIdRef.current ?? selectedBoxId!;
          if (!id) break;
          const item = (detectedItems || []).find((i) => i.id === id);
          if (!item) break;
          const handle = stateRef.current.resizeHandle;
          if (!handle) break;

          let { x1, y1, x2, y2 } = item.box;

          // ОСНОВНОЕ: горизонталь и вертикаль
          if (handle.includes("left")) x1 = Math.min(ip.x, x2 - MIN_SIZE);
          if (handle.includes("right")) x2 = Math.max(ip.x, x1 + MIN_SIZE);
          if (handle.includes("top")) y1 = Math.min(ip.y, y2 - MIN_SIZE);
          if (handle.includes("bottom")) y2 = Math.max(ip.y, y1 + MIN_SIZE);

          const nb: BoundingBox = {
            x1: Math.min(x1, x2),
            y1: Math.min(y1, y2),
            x2: Math.max(x1, x2),
            y2: Math.max(y1, y2),
          };
          onUpdateBubble(id, nb);
          break;
        }
      }
    };

    const onPointerUp = (sx: number, sy: number) => {
      const dist = Math.hypot(
        sx - stateRef.current.startPos.x,
        sy - stateRef.current.startPos.y
      );

      // Деселект только если клик (без движения) по пустому месту
      if (
        stateRef.current.action === "panning" &&
        dist < CLICK_THRESHOLD &&
        !stateRef.current.clickedOnBubble
      ) {
        onBoxSelect(null);
      }

      if (stateRef.current.action === "drawing") {
        const nb = stateRef.current.currentNewBox;
        if (nb && nb.x2 - nb.x1 >= MIN_SIZE && nb.y2 - nb.y1 >= MIN_SIZE)
          onAddBubble(nb);
      }

      stateRef.current.action = null;
      stateRef.current.currentNewBox = null;
      stateRef.current.initialBox = null;
      stateRef.current.initialImagePoint = { x: 0, y: 0 };
      stateRef.current.clickedOnBubble = false;
      setDrawingBox(null);
      activeIdRef.current = null;
    };

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      onPointerDown(e.clientX, e.clientY);
      const mm = (ev: MouseEvent) => onPointerMove(ev.clientX, ev.clientY);
      const mu = (ev: MouseEvent) => {
        window.removeEventListener("mousemove", mm);
        window.removeEventListener("mouseup", mu);
        onPointerUp(ev.clientX, ev.clientY);
      };
      window.addEventListener("mousemove", mm);
      window.addEventListener("mouseup", mu);
    };

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

    container.addEventListener("mousedown", onMouseDown);
    container.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      container.removeEventListener("mousedown", onMouseDown);
      container.removeEventListener("wheel", onWheel);
    };
  }, [
    detectedItems,
    selectedBoxId,
    editMode,
    isAdding,
    onBoxSelect,
    onAddBubble,
    onUpdateBubble,
  ]);

  return { scale, position };
}
