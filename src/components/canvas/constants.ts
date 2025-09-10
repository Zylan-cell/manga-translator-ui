import { BoundingBox } from "../../types";

// ИЗМЕНЕНИЕ: Добавлены новые типы ручек для сторон
export type Handle =
  | "topLeft"
  | "topRight"
  | "bottomLeft"
  | "bottomRight"
  | "top"
  | "bottom"
  | "left"
  | "right";
export type Action =
  | "panning"
  | "resizing"
  | "drawing"
  | "moving"
  | "painting"
  | "masking";

export const HANDLE_SIZE = 10;
export const CLICK_THRESHOLD = 5;
export const DEFAULT_BRUSH_SIZE = 20;

// ИЗМЕНЕНИЕ: Добавлены курсоры для новых ручек
export const cursors: Record<Handle, string> = {
  topLeft: "nwse-resize",
  topRight: "nesw-resize",
  bottomLeft: "nesw-resize",
  bottomRight: "nwse-resize",
  top: "ns-resize",
  bottom: "ns-resize",
  left: "ew-resize",
  right: "ew-resize",
};

export function getHandleAtPos(
  imgX: number,
  imgY: number,
  box: BoundingBox,
  scale: number
): Handle | null {
  const tol = Math.max(HANDLE_SIZE, 12) / scale;
  const half = tol / 2;

  // ИЗМЕНЕНИЕ: Добавлены координаты для новых ручек
  const handles: Record<Handle, { x: number; y: number }> = {
    topLeft: { x: box.x1, y: box.y1 },
    topRight: { x: box.x2, y: box.y1 },
    bottomLeft: { x: box.x1, y: box.y2 },
    bottomRight: { x: box.x2, y: box.y2 },
    top: { x: (box.x1 + box.x2) / 2, y: box.y1 },
    bottom: { x: (box.x1 + box.x2) / 2, y: box.y2 },
    left: { x: box.x1, y: (box.y1 + box.y2) / 2 },
    right: { x: box.x2, y: (box.y1 + box.y2) / 2 },
  };

  // Сначала проверяем углы, так как они важнее
  const corners: Handle[] = [
    "topLeft",
    "topRight",
    "bottomLeft",
    "bottomRight",
  ];
  for (const name of corners) {
    const pos = handles[name];
    if (Math.abs(imgX - pos.x) <= half && Math.abs(imgY - pos.y) <= half) {
      return name;
    }
  }

  // Затем проверяем стороны
  const sides: Handle[] = ["top", "bottom", "left", "right"];
  for (const name of sides) {
    const pos = handles[name];
    if (Math.abs(imgX - pos.x) <= half && Math.abs(imgY - pos.y) <= half) {
      return name;
    }
  }

  return null;
}
