import {
  BoundingBox,
  TextItem,
  TextProperties,
  DEFAULT_TEXT_PROPERTIES,
} from "../../types";
import { LaidOutTextItem } from "../../hooks/useTextLayout";
import { HANDLE_SIZE } from "./constants";

interface DrawParams {
  position: { x: number; y: number };
  scale: number;
  detectedItems: LaidOutTextItem[] | null;
  selectedBoxId: number | null;
  editMode: boolean;
  drawingBox: BoundingBox | null;
  maskCanvas?: HTMLCanvasElement | null;
  maskMode?: boolean;
  textItems?: TextItem[] | null;
  brushSize?: number;
  eraseMode?: boolean;
}

export function createMaskCanvas(
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, width, height); // прозрачный фон
  }
  return canvas;
}

export function drawMaskBrush(
  maskCanvas: HTMLCanvasElement,
  x: number,
  y: number,
  brushSize: number,
  eraseMode: boolean = false
) {
  const ctx = maskCanvas.getContext("2d");
  if (!ctx) return;
  ctx.save();
  ctx.globalCompositeOperation = eraseMode ? "destination-out" : "source-over";
  ctx.fillStyle = eraseMode ? "transparent" : "white"; // В ХРАНИЛИЩЕ МАСКИ — белым!
  ctx.beginPath();
  ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function getMaskDataUrl(maskCanvas: HTMLCanvasElement): string {
  const out = document.createElement("canvas");
  out.width = maskCanvas.width;
  out.height = maskCanvas.height;
  const octx = out.getContext("2d");
  if (!octx) return maskCanvas.toDataURL("image/png");
  // фон чёрный
  octx.fillStyle = "black";
  octx.fillRect(0, 0, out.width, out.height);
  // белые мазки
  octx.drawImage(maskCanvas, 0, 0);
  return out.toDataURL("image/png");
}

export function clearMask(maskCanvas: HTMLCanvasElement) {
  const ctx = maskCanvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
}

export function drawPrecalculatedText(
  ctx: CanvasRenderingContext2D,
  item: LaidOutTextItem
) {
  if (!item.layout || item.layout.lines.length === 0) return;

  const { box, layout } = item;

  const textProps: TextProperties =
    item.textProperties || DEFAULT_TEXT_PROPERTIES;

  const { lines, fontSize, lineHeight } = layout;
  const padding = 4;
  const maxWidth = box.x2 - box.x1 - padding * 2;
  const maxHeight = box.y2 - box.y1 - padding * 2;
  const totalHeight = lines.length * lineHeight;

  ctx.save();
  ctx.font = `${textProps.fontStyle} ${textProps.fontWeight} ${fontSize}px "${textProps.fontFamily}", sans-serif`;
  ctx.fillStyle = textProps.color;
  ctx.strokeStyle = textProps.strokeColor;
  ctx.lineWidth = textProps.strokeWidth;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const startY = box.y1 + padding + (maxHeight - totalHeight) / 2;
  const centerX = box.x1 + padding + maxWidth / 2;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const y = startY + i * lineHeight;
    if (textProps.strokeWidth > 0) {
      ctx.strokeText(line, centerX, y);
    }
    ctx.fillText(line, centerX, y);
  }
  ctx.restore();
}

export function drawOverlay(
  canvas: HTMLCanvasElement,
  container: HTMLDivElement,
  image: HTMLImageElement,
  {
    position,
    scale,
    detectedItems,
    selectedBoxId,
    editMode,
    drawingBox,
    maskCanvas,
    maskMode,
    textItems,
  }: DrawParams
) {
  if (!image || !image.complete || image.naturalWidth === 0) return;

  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(position.x, position.y);
  ctx.scale(scale, scale);

  // Рисуем маску только в режиме Mask Mode
  if (maskMode && maskCanvas && maskCanvas.width && maskCanvas.height) {
    drawMaskOverlayRed(ctx, maskCanvas, 0.7);
  }

  if (!maskMode) {
    detectedItems?.forEach((item) => {
      const { x1, y1, x2, y2 } = item.box;
      const isSelected = item.id === selectedBoxId;
      ctx.strokeStyle = isSelected ? "#ff3e00" : "#3b82f6";
      ctx.lineWidth = isSelected ? 3 / scale : 1.5 / scale;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

      if (editMode && item.translation && item.layout) {
        drawPrecalculatedText(ctx, item);
      } else {
        const fontSize = Math.max(12, 16) / scale;
        ctx.font = `bold ${fontSize}px "Segoe UI", "Arial", sans-serif`;
        ctx.fillStyle = isSelected ? "#ff3e00" : "#3b82f6";
        const text = String(item.id);
        const textWidth = ctx.measureText(text).width;
        const textHeight = fontSize * 0.8;
        ctx.fillRect(x1, y1, textWidth + 8 / scale, textHeight + 8 / scale);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(text, x1 + 4 / scale, y1 + textHeight + 2 / scale);
      }
    });

    if (editMode) {
      const sel = detectedItems?.find((i) => i.id === selectedBoxId);
      if (sel) {
        const { x1, y1, x2, y2 } = sel.box;
        const s = HANDLE_SIZE / scale;
        const halfS = s / 2;
        ctx.fillStyle = "#ff3e00";

        // Углы
        ctx.fillRect(x1 - halfS, y1 - halfS, s, s);
        ctx.fillRect(x2 - halfS, y1 - halfS, s, s);
        ctx.fillRect(x1 - halfS, y2 - halfS, s, s);
        ctx.fillRect(x2 - halfS, y2 - halfS, s, s);

        // ИЗМЕНЕНИЕ: Добавлена отрисовка новых точек по центрам сторон
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        ctx.fillRect(midX - halfS, y1 - halfS, s, s); // Top
        ctx.fillRect(midX - halfS, y2 - halfS, s, s); // Bottom
        ctx.fillRect(x1 - halfS, midY - halfS, s, s); // Left
        ctx.fillRect(x2 - halfS, midY - halfS, s, s); // Right
      }
    }

    if (drawingBox) {
      const { x1, y1, x2, y2 } = drawingBox;
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2 / scale;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    }
  }

  if (textItems && textItems.length) {
    textItems.forEach((t) => {
      const fs = Math.max(8, t.fontSize);
      ctx.font = `${fs}px "${t.fontFamily}", sans-serif`;
      ctx.fillStyle = t.color;
      ctx.textBaseline = "top";
      ctx.fillText(t.text, t.x, t.y);
    });
  }
  ctx.restore();
}

function drawMaskOverlayRed(
  ctx: CanvasRenderingContext2D,
  maskCanvas: HTMLCanvasElement,
  opacity = 0.6
) {
  const tmp = document.createElement("canvas");
  tmp.width = maskCanvas.width;
  tmp.height = maskCanvas.height;
  const tctx = tmp.getContext("2d");
  if (!tctx) return;

  // 1) Копируем белые мазки
  tctx.clearRect(0, 0, tmp.width, tmp.height);
  tctx.drawImage(maskCanvas, 0, 0);

  // 2) Тонируем в красный внутри формы мазка
  tctx.globalCompositeOperation = "source-in";
  tctx.fillStyle = "rgba(255, 0, 0, 1)";
  tctx.fillRect(0, 0, tmp.width, tmp.height);

  // 3) Рисуем на основной контекст с нужной прозрачностью
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.drawImage(tmp, 0, 0);
  ctx.restore();
}
