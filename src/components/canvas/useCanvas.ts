import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { RefObject } from "preact";
import { BoundingBox, DetectedTextItem, TextItem } from "../../types";
import { Action, CLICK_THRESHOLD, getHandleAtPos, Handle } from "./constants";
import { drawOverlay } from "./draw";
import { LaidOutTextItem } from "../../hooks/useTextLayout";

interface UseCanvasArgs {
  containerRef: RefObject<HTMLDivElement>;
  imageRef: RefObject<HTMLImageElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  detectedItems: LaidOutTextItem[] | null;
  selectedBoxId: number | null;
  editMode: boolean;
  isAdding: boolean;
  textMode?: boolean;
  onAddTextAt?: (x: number, y: number) => void;
  textItems?: TextItem[] | null;
  onBoxSelect: (item: DetectedTextItem | null) => void;
  onAddBubble: (box: BoundingBox) => void;
  onUpdateBubble: (id: number, box: BoundingBox) => void;
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
  textMode,
  onAddTextAt,
  textItems,
  onBoxSelect,
  onAddBubble,
  onUpdateBubble,
  maskMode = false,
  eraseMode = false,
  brushSize = 24,
  takeManualMaskSnapshot,
  onMaskSnapshot,
  clearMaskSignal,
  onMaskCleared,
  onUndoExternal,
}: UseCanvasArgs) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [drawingBox, setDrawingBox] = useState<BoundingBox | null>(null);

  const actionRef = useRef<Action | null>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const lastPosRef = useRef({ x: 0, y: 0 });
  const pinchStartDistRef = useRef(0);

  const resizeHandleRef = useRef<Handle | null>(null);
  const currentNewBoxRef = useRef<BoundingBox | null>(null);
  const initialBubblePosRef = useRef<BoundingBox | null>(null);

  const maskCanvasRef = useRef<HTMLCanvasElement>(
    document.createElement("canvas")
  );
  const [maskVersion, setMaskVersion] = useState(0);
  const [maskHasContent, setMaskHasContent] = useState(false);

  const undoStack = useRef<(() => void)[]>([]);
  const undo = () => {
    const fn = undoStack.current.pop();
    if (fn) fn();
    requestAnimationFrame(draw);
  };
  useEffect(() => {
    onUndoExternal?.(undo);
  }, [onUndoExternal]);

  const screenToImage = useCallback(
    (screenX: number, screenY: number) => {
      const container = containerRef.current;
      if (!container) return { x: 0, y: 0 };
      const rect = container.getBoundingClientRect();
      const x = (screenX - rect.left - position.x) / scale;
      const y = (screenY - rect.top - position.y) / scale;
      return { x, y };
    },
    [containerRef, position, scale]
  );

  const draw = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!container || !canvas || !image) return;

    drawOverlay(canvas, container, image, {
      position,
      scale,
      detectedItems,
      selectedBoxId,
      editMode,
      drawingBox,
      maskCanvas: maskCanvasRef.current,
      maskMode,
      textItems: textItems || null,
    });
  }, [
    position,
    scale,
    detectedItems,
    selectedBoxId,
    editMode,
    drawingBox,
    maskMode,
    textItems,
    maskVersion,
  ]);

  useEffect(() => {
    requestAnimationFrame(draw);
  }, [draw]);

  useEffect(() => {
    const img = imageRef.current;
    if (!img) return;
    const onLoad = () => {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      const mc = maskCanvasRef.current;
      mc.width = img.naturalWidth || img.width;
      mc.height = img.naturalHeight || img.height;
      const mctx = mc.getContext("2d");
      if (mctx) mctx.clearRect(0, 0, mc.width, mc.height);
      setMaskHasContent(false);
      setMaskVersion((v) => v + 1);
    };
    if (img.complete) onLoad();
    else img.addEventListener("load", onLoad);
    return () => img.removeEventListener("load", onLoad);
  }, [imageRef]);

  useEffect(() => {
    if (takeManualMaskSnapshot === undefined || takeManualMaskSnapshot === 0)
      return;
    if (!onMaskSnapshot) return;
    const mc = maskCanvasRef.current;
    if (!maskHasContent) {
      onMaskSnapshot(null);
      return;
    }
    onMaskSnapshot(mc.toDataURL("image/png"));
  }, [takeManualMaskSnapshot, maskHasContent, onMaskSnapshot]);

  useEffect(() => {
    if (clearMaskSignal === undefined || clearMaskSignal === 0) return;
    const mc = maskCanvasRef.current;
    const mctx = mc.getContext("2d");
    if (mctx && mc.width && mc.height) {
      mctx.clearRect(0, 0, mc.width, mc.height);
      setMaskHasContent(false);
      setMaskVersion((v) => v + 1);
      onMaskCleared?.();
    }
  }, [clearMaskSignal, onMaskCleared]);

  const paintAt = (imgX: number, imgY: number) => {
    const mc = maskCanvasRef.current;
    const mctx = mc.getContext("2d");
    if (!mctx) return;
    const radius = Math.max(1, brushSize / 2);
    mctx.save();
    mctx.globalCompositeOperation = eraseMode
      ? "destination-out"
      : "source-over";
    mctx.fillStyle = "#ffffff";
    mctx.beginPath();
    mctx.arc(imgX, imgY, radius, 0, Math.PI * 2);
    mctx.fill();
    mctx.restore();
    setMaskHasContent(true);
    setMaskVersion((v) => v + 1);
  };

  const handlePointerDown = useCallback(
    (x: number, y: number) => {
      startPosRef.current = { x, y };
      lastPosRef.current = { x, y };
      const imgPt = screenToImage(x, y);

      if (textMode && onAddTextAt) {
        onAddTextAt(imgPt.x, imgPt.y);
        return;
      }
      if (maskMode) {
        actionRef.current = "painting";
        paintAt(imgPt.x, imgPt.y);
        return;
      }
      if (editMode && isAdding) {
        actionRef.current = "drawing";
        const newBox: BoundingBox = {
          x1: imgPt.x,
          y1: imgPt.y,
          x2: imgPt.x,
          y2: imgPt.y,
          confidence: 1,
        };
        currentNewBoxRef.current = newBox;
        setDrawingBox(newBox);
        return;
      }
      if (editMode) {
        const sel = detectedItems?.find((it) => it.id === selectedBoxId);
        if (sel) {
          const handle = getHandleAtPos(imgPt.x, imgPt.y, sel.box, scale);
          if (handle) {
            actionRef.current = "resizing";
            resizeHandleRef.current = handle;
            return;
          }
          const { x1, y1, x2, y2 } = sel.box;
          if (
            imgPt.x >= x1 &&
            imgPt.x <= x2 &&
            imgPt.y >= y1 &&
            imgPt.y <= y2
          ) {
            actionRef.current = "moving";
            initialBubblePosRef.current = sel.box;
            return;
          }
        }
      }
      const clicked = detectedItems
        ?.slice()
        .reverse()
        .find((it) => {
          const { x1, y1, x2, y2 } = it.box;
          return (
            imgPt.x >= x1 && imgPt.x <= x2 && imgPt.y >= y1 && imgPt.y <= y2
          );
        });
      if (clicked) onBoxSelect(clicked);
      else actionRef.current = "panning";
    },
    [
      screenToImage,
      textMode,
      onAddTextAt,
      maskMode,
      editMode,
      isAdding,
      detectedItems,
      selectedBoxId,
      scale,
      onBoxSelect,
    ]
  );

  const handlePointerMove = useCallback(
    (x: number, y: number) => {
      const container = containerRef.current;
      if (!container) return;
      const action = actionRef.current;
      const dx = x - lastPosRef.current.x;
      const dy = y - lastPosRef.current.y;
      lastPosRef.current = { x, y };

      if (!action) {
        /* ... cursor logic ... */ return;
      }

      const imgPt = screenToImage(x, y);
      const startImgPt = screenToImage(
        startPosRef.current.x,
        startPosRef.current.y
      );

      switch (action) {
        case "panning":
          setPosition((pos) => ({ x: pos.x + dx, y: pos.y + dy }));
          break;
        case "painting":
          paintAt(imgPt.x, imgPt.y);
          break;
        case "drawing": {
          const box: BoundingBox = {
            x1: Math.min(startImgPt.x, imgPt.x),
            y1: Math.min(startImgPt.y, imgPt.y),
            x2: Math.max(startImgPt.x, imgPt.x),
            y2: Math.max(startImgPt.y, imgPt.y),
            confidence: 1,
          };
          currentNewBoxRef.current = box;
          setDrawingBox(box);
          break;
        }
        case "moving": {
          const init = initialBubblePosRef.current;
          if (!init || !selectedBoxId) break;
          const imgDx = imgPt.x - startImgPt.x;
          const imgDy = imgPt.y - startImgPt.y;
          onUpdateBubble(selectedBoxId, {
            ...init,
            x1: init.x1 + imgDx,
            y1: init.y1 + imgDy,
            x2: init.x2 + imgDx,
            y2: init.y2 + imgDy,
          });
          break;
        }
        case "resizing": {
          const handle = resizeHandleRef.current;
          if (!handle || !selectedBoxId) break;
          const item = detectedItems?.find((i) => i.id === selectedBoxId);
          if (!item) break;
          let { x1, y1, x2, y2 } = item.box;
          if (handle.includes("left")) x1 = imgPt.x;
          if (handle.includes("right")) x2 = imgPt.x;
          if (handle.includes("top")) y1 = imgPt.y;
          if (handle.includes("bottom")) y2 = imgPt.y;
          onUpdateBubble(selectedBoxId, {
            x1: Math.min(x1, x2),
            y1: Math.min(y1, y2),
            x2: Math.max(x1, x2),
            y2: Math.max(y1, y2),
            confidence: item.box.confidence,
          });
          break;
        }
      }
    },
    [screenToImage, onUpdateBubble, selectedBoxId, detectedItems]
  );

  const handlePointerUp = useCallback(() => {
    const dist = Math.hypot(
      lastPosRef.current.x - startPosRef.current.x,
      lastPosRef.current.y - startPosRef.current.y
    );
    if (actionRef.current === "panning" && dist < CLICK_THRESHOLD)
      onBoxSelect(null);
    if (actionRef.current === "drawing" && !maskMode) {
      const b = currentNewBoxRef.current;
      if (b && b.x2 - b.x1 > 5 && b.y2 - b.y1 > 5) onAddBubble(b);
    }
    actionRef.current = null;
    resizeHandleRef.current = null;
    initialBubblePosRef.current = null;
    currentNewBoxRef.current = null;
    setDrawingBox(null);
  }, [onBoxSelect, onAddBubble, maskMode]);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      const container = containerRef.current;
      if (!container) return;
      if (e.ctrlKey) e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const newScale = Math.max(
        0.1,
        Math.min(scale * (1 - e.deltaY * 0.001), 10)
      );
      const worldX = (mouseX - position.x) / scale;
      const worldY = (mouseY - position.y) / scale;
      const newX = mouseX - worldX * newScale;
      const newY = mouseY - worldY * newScale;
      setScale(newScale);
      setPosition({ x: newX, y: newY });
    },
    [scale, position]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      handlePointerDown(e.clientX, e.clientY);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    };
    const onMouseMove = (e: MouseEvent) =>
      handlePointerMove(e.clientX, e.clientY);
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      handlePointerUp();
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2) {
        actionRef.current = null;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStartDistRef.current = Math.hypot(dx, dy);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDist = Math.hypot(dx, dy);
        if (pinchStartDistRef.current === 0) {
          pinchStartDistRef.current = currentDist;
          return;
        }
        const scaleChange = currentDist / pinchStartDistRef.current;
        pinchStartDistRef.current = currentDist;

        const rect = container.getBoundingClientRect();
        const centerX =
          (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const centerY =
          (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        const newScale = Math.max(0.1, Math.min(scale * scaleChange, 10));
        const worldX = (centerX - position.x) / scale;
        const worldY = (centerY - position.y) / scale;
        const newX = centerX - worldX * newScale;
        const newY = centerY - worldY * newScale;
        setScale(newScale);
        setPosition({ x: newX, y: newY });
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) handlePointerUp();
    };

    container.addEventListener("mousedown", onMouseDown);
    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("touchstart", onTouchStart, { passive: false });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd);
    container.addEventListener("touchcancel", onTouchEnd);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      container.removeEventListener("mousedown", onMouseDown);
      container.removeEventListener("wheel", handleWheel as any);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    scale,
    position,
  ]);

  return { scale, position };
}
