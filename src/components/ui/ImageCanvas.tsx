import { useRef } from "preact/hooks";
import { BoundingBox, DetectedTextItem, TextItem } from "../../types";
import { useCanvas } from "../canvas/useCanvas";
import { LaidOutTextItem } from "../../hooks/useTextLayout";

interface ImageCanvasProps {
  imageSrc: string | null;
  detectedItems: LaidOutTextItem[] | null;
  selectedBoxId: number | null;
  editMode: boolean;
  isAdding: boolean;
  onBoxSelect: (item: DetectedTextItem | null) => void;
  onAddBubble: (box: BoundingBox) => void;
  onUpdateBubble: (id: number, box: BoundingBox) => void;
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

export default function ImageCanvas(props: ImageCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  const { scale, position } = useCanvas({
    containerRef,
    imageRef,
    canvasRef: overlayRef,
    detectedItems: props.detectedItems,
    selectedBoxId: props.selectedBoxId,
    editMode: props.editMode,
    isAdding: props.isAdding,
    textMode: props.textMode,
    onAddTextAt: props.onAddTextAt,
    textItems: props.textItems,
    onBoxSelect: props.onBoxSelect,
    onAddBubble: props.onAddBubble,
    onUpdateBubble: props.onUpdateBubble,
    maskMode: props.maskMode,
    eraseMode: props.eraseMode,
    brushSize: props.brushSize,
    takeManualMaskSnapshot: props.takeManualMaskSnapshot,
    onMaskSnapshot: props.onMaskSnapshot,
    clearMaskSignal: props.clearMaskSignal,
    onMaskCleared: props.onMaskCleared,
    onUndoExternal: props.onUndoExternal,
  });

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "#e5e7eb",
        cursor: "grab",
        position: "relative",
        touchAction: "none", // Отключаем стандартные действия браузера для сенсорных событий
      }}
    >
      {props.imageSrc ? (
        <>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: "top left",
              pointerEvents: "none",
            }}
          >
            <img
              ref={imageRef}
              src={props.imageSrc}
              alt="Uploaded manga"
              style={{
                display: "block",
                userSelect: "none",
                pointerEvents: "none",
              }}
              draggable={false}
            />
          </div>

          <canvas
            ref={overlayRef}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          />
        </>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
          }}
        >
          <p>Upload an image to start</p>
        </div>
      )}
    </div>
  );
}
