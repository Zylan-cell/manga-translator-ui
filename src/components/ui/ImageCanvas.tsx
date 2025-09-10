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
  textItems?: TextItem[] | null;
  maskMode?: boolean;
  eraseMode?: boolean;
  brushSize?: number;
  takeManualMaskSnapshot?: number;
  keepViewportToken?: number;
  onMaskSnapshot?: (dataUrl: string | null) => void;
  clearMaskSignal?: number;
  onMaskCleared?: () => void;
  onUndoExternal?: (undo: () => void) => void;
}

export default function ImageCanvas(props: ImageCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  // --- ИЗМЕНЕНИЕ ЗДЕСЬ ---
  // Мы снова "ловим" scale и position, которые возвращает хук useCanvas
  const { scale, position } = useCanvas({
    containerRef,
    imageRef,
    canvasRef: overlayRef,
    ...props,
    keepViewportToken: props.keepViewportToken,
  });

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "#e5e7eb",
        cursor: props.maskMode ? "crosshair" : "grab",
      }}
      onDragStart={(e) => e.preventDefault()}
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
