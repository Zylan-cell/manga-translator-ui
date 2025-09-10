import { useState, useEffect, useMemo } from "preact/hooks";
import {
  DetectedTextItem,
  BoundingBox,
  TextProperties,
  DEFAULT_TEXT_PROPERTIES,
} from "../types";

export interface LaidOutTextItem extends DetectedTextItem {
  layout?: {
    lines: string[];
    fontSize: number;
    lineHeight: number;
  };
}

function calcLayout(
  ctx: CanvasRenderingContext2D,
  text: string,
  box: BoundingBox,
  textProps: TextProperties
) {
  const padding = 4;
  const maxW = Math.max(8, box.x2 - box.x1 - padding * 2);

  // ИЗМЕНЕНИЕ: Размер шрифта теперь фиксирован и берется из настроек
  const fontSize = textProps.fontSize;
  ctx.font = `${textProps.fontStyle} ${textProps.fontWeight} ${fontSize}px "${textProps.fontFamily}", sans-serif`;
  const lineHeight = Math.ceil(fontSize * 1.2);

  if (!text) return { lines: [""], fontSize, lineHeight };

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = words[0] || "";

  for (let i = 1; i < words.length; i++) {
    const testLine = currentLine + " " + words[i];
    if (ctx.measureText(testLine).width > maxW && currentLine) {
      lines.push(currentLine);
      currentLine = words[i];
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  // Возвращаем результат с фиксированным размером шрифта
  return { lines, fontSize, lineHeight };
}

export function useTextLayout(
  items: DetectedTextItem[] | null
): LaidOutTextItem[] | null {
  const [laidOutItems, setLaidOutItems] = useState<LaidOutTextItem[] | null>(
    null
  );

  const ctx = useMemo(() => {
    if (typeof window === "undefined") return null;
    const c = document.createElement("canvas");
    return c.getContext("2d");
  }, []);

  useEffect(() => {
    if (!items || !ctx) {
      setLaidOutItems(null);
      return;
    }
    const next = items.map((it) => {
      if (!it.translation) {
        const { layout, ...rest } = it as LaidOutTextItem;
        return rest;
      }

      const textProps = it.textProperties || DEFAULT_TEXT_PROPERTIES;

      const layout = calcLayout(ctx, it.translation, it.box, textProps);
      return { ...it, layout };
    });
    setLaidOutItems(next);
  }, [items, ctx]);

  return laidOutItems;
}
