import { useState, useEffect, useMemo } from "preact/hooks";
import { DetectedTextItem, BoundingBox } from "../types";

export interface LaidOutTextItem extends DetectedTextItem {
  layout?: {
    lines: string[];
    fontSize: number;
    lineHeight: number;
  };
}

function breakByChars(
  ctx: CanvasRenderingContext2D,
  s: string,
  maxWidth: number
) {
  const out: string[] = [];
  let cur = "";
  for (const ch of s) {
    const test = cur + ch;
    if (ctx.measureText(test).width > maxWidth && cur) {
      out.push(cur);
      cur = ch;
    } else {
      cur = test;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function calcLayout(
  ctx: CanvasRenderingContext2D,
  text: string,
  box: BoundingBox
) {
  const padding = 4;
  const maxW = Math.max(8, box.x2 - box.x1 - padding * 2);
  const maxH = Math.max(8, box.y2 - box.y1 - padding * 2);

  if (!text) return { lines: [""], fontSize: 10, lineHeight: 12 };

  let fontSize = Math.min(64, maxH);
  let chosen = { lines: [text], fontSize: 10, lineHeight: 12 };

  // цикл уменьшения шрифта
  while (fontSize >= 6) {
    ctx.font = `bold ${fontSize}px "Arial Black", sans-serif`;
    const lh = Math.ceil(fontSize * 1.2);

    // сперва пробуем разбивку по словам
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let cur = words[0] || "";
    for (let i = 1; i < words.length; i++) {
      const test = cur + " " + words[i];
      if (ctx.measureText(test).width > maxW && cur) {
        lines.push(cur);
        cur = words[i];
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);

    // если хоть одна строка всё ещё длиннее maxW — делим её посимвольно
    for (let i = 0; i < lines.length; i++) {
      if (ctx.measureText(lines[i]).width > maxW) {
        const broken = breakByChars(ctx, lines[i], maxW);
        lines.splice(i, 1, ...broken);
        i += broken.length - 1;
      }
    }

    if (lines.length * lh <= maxH) {
      chosen = { lines, fontSize, lineHeight: lh };
      break;
    }
    fontSize -= 1;
  }
  return chosen;
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
      if (!it.translation) return it;
      const layout = calcLayout(ctx, it.translation, it.box);
      return { ...it, layout };
    });
    setLaidOutItems(next);
  }, [items, ctx]);

  return laidOutItems;
}
