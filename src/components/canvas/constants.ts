import { BoundingBox } from "../../types";

export type Handle = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
export type Action = "panning" | "resizing" | "drawing" | "moving" | "painting";

export const HANDLE_SIZE = 10;
export const CLICK_THRESHOLD = 5;

export const cursors: Record<Handle, string> = {
  topLeft: "nwse-resize",
  topRight: "nesw-resize",
  bottomLeft: "nesw-resize",
  bottomRight: "nwse-resize",
};

export function getHandleAtPos(
  imgX: number,
  imgY: number,
  box: BoundingBox,
  scale: number
): Handle | null {
  // делаем «зону» побольше и масштабозависимой
  const tol = Math.max(HANDLE_SIZE, 12) / scale;
  const half = tol / 2;

  const handles: Record<Handle, { x: number; y: number }> = {
    topLeft: { x: box.x1, y: box.y1 },
    topRight: { x: box.x2, y: box.y1 },
    bottomLeft: { x: box.x1, y: box.y2 },
    bottomRight: { x: box.x2, y: box.y2 },
  };

  for (const [name, pos] of Object.entries(handles)) {
    if (Math.abs(imgX - pos.x) <= half && Math.abs(imgY - pos.y) <= half) {
      return name as Handle;
    }
  }
  return null;
}
