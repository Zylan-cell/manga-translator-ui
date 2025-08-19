import { useState, useEffect, useMemo } from "preact/hooks";
import { DetectedTextItem, BoundingBox } from "../types";

export interface LaidOutTextItem extends DetectedTextItem {
  layout?: {
    lines: string[];
    fontSize: number;
    lineHeight: number;
  };
}

function calculateTextLayout(
  ctx: CanvasRenderingContext2D,
  text: string,
  box: BoundingBox
) {
  const padding = 4;
  const maxWidth = box.x2 - box.x1 - padding * 2;
  const maxHeight = box.y2 - box.y1 - padding * 2;

  if (maxWidth <= 0 || maxHeight <= 0 || !text) {
    return { lines: [text || ""], fontSize: 10, lineHeight: 12 };
  }

  let fontSize = maxHeight;
  let lines: string[] = [];
  let lineHeight = 0;

  while (fontSize > 6) {
    ctx.font = `bold ${fontSize}px "Arial Black", sans-serif`;
    lineHeight = fontSize * 1.2;
    const words = text.split(" ");
    lines = [];
    let currentLine = words[0] || "";

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine + " " + word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);

    if (lines.length * lineHeight <= maxHeight) {
      break;
    }
    fontSize--;
  }
  return { lines, fontSize, lineHeight };
}

export function useTextLayout(
  items: DetectedTextItem[] | null
): LaidOutTextItem[] | null {
  const [laidOutItems, setLaidOutItems] = useState<LaidOutTextItem[] | null>(
    null
  );

  const measurementContext = useMemo(() => {
    if (typeof window === "undefined") return null;
    const canvas = document.createElement("canvas");
    return canvas.getContext("2d");
  }, []);

  useEffect(() => {
    if (!items || !measurementContext) {
      setLaidOutItems(null);
      return;
    }

    const newItems = items.map((item) => {
      if (!item.translation) {
        return item;
      }
      const layout = calculateTextLayout(
        measurementContext,
        item.translation,
        item.box
      );
      return { ...item, layout };
    });
    setLaidOutItems(newItems);
  }, [items, measurementContext]);

  return laidOutItems;
}
