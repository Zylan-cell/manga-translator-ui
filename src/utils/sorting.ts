//src / utils / sorting.ts;
import { BoundingBox } from "../types";

type PanelRect = number[] | [number, number, number, number];

function toRect(p: PanelRect): [number, number, number, number] {
  const [x1, y1, x2, y2] = p as any;
  return [x1, y1, x2, y2];
}

function w(b: { x1: number; x2: number }) {
  return Math.max(1, b.x2 - b.x1);
}
function h(b: { y1: number; y2: number }) {
  return Math.max(1, b.y2 - b.y1);
}
function cx(b: { x1: number; x2: number }) {
  return (b.x1 + b.x2) / 2;
}

function vOverlap(
  a: { y1: number; y2: number },
  b: { y1: number; y2: number }
) {
  return Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
}

/**

Правило чтения для манги (RTL):
если есть существенное вертикальное перекрытие -> считаем в одной “строке” и сортируем справа налево
иначе сортируем сверху вниз
*/
const ROW_OVERLAP_RATIO = 0.35; // 35% от меньшей высоты — можно подправить под ваши страницы
function rtlCompareBoxes<
  A extends { x1: number; y1: number; x2: number; y2: number }
>(a: A, b: A) {
  const ov = vOverlap(a, b);
  const minH = Math.min(h(a), h(b));
  const sameRow = ov / minH >= ROW_OVERLAP_RATIO;

  if (sameRow) {
    // одна "строка" → справа налево
    const dx = cx(b) - cx(a);
    if (Math.abs(dx) > 1e-6) return dx;
  }

  // разные "строки" → сверху вниз
  const dy = a.y1 - b.y1;
  if (Math.abs(dy) > 1e-6) return dy;

  // запасной критерий — справа налево
  return cx(b) - cx(a);
}

function getIntersectionArea(bubble: BoundingBox, panel: PanelRect): number {
  const [px1, py1, px2, py2] = toRect(panel);
  const { x1, y1, x2, y2 } = bubble;

  const ix1 = Math.max(x1, px1);
  const iy1 = Math.max(y1, py1);
  const ix2 = Math.min(x2, px2);
  const iy2 = Math.min(y2, py2);

  const iw = ix2 - ix1;
  const ih = iy2 - iy1;
  return iw > 0 && ih > 0 ? iw * ih : 0;
}

function assignBubbleToPanel(bubble: BoundingBox, panels: PanelRect[]): number {
  let best = -1;
  let bestArea = 0;
  for (let i = 0; i < panels.length; i++) {
    const a = getIntersectionArea(bubble, panels[i]);
    if (a > bestArea) {
      bestArea = a;
      best = i;
    }
  }
  return best;
}

function sortPanelsRTL(panels: PanelRect[]): PanelRect[] {
  if (!panels || panels.length <= 1) return panels || [];
  const items = panels.map((p) => {
    const [x1, y1, x2, y2] = toRect(p);
    return { x1, y1, x2, y2, raw: p };
  });
  items.sort(rtlCompareBoxes);
  return items.map((i) => i.raw);
}

function sortBubblesRTL(list: BoundingBox[]): BoundingBox[] {
  if (!list || list.length <= 1) return list || [];

  const items = list.map((b) => ({ ...b }));
  const columns: BoundingBox[][] = [];

  // Сортируем все баблы сначала справа налево, чтобы упростить группировку
  items.sort((a, b) => cx(b) - cx(a));

  // 1. Улучшенная группировка в вертикальные колонки
  for (const item of items) {
    let foundColumn = false;
    // Ищем ближайшую колонку, в которую можно добавить бабл
    for (const col of columns) {
      const representative = col[0];
      // Условие: центр бабла по горизонтали находится не дальше, чем половина ширины, от центра колонки
      if (Math.abs(cx(item) - cx(representative)) < w(representative) / 2) {
        col.push(item);
        foundColumn = true;
        break;
      }
    }
    if (!foundColumn) {
      columns.push([item]);
    }
  }

  // 2. Сортируем колонки между собой (справа налево) - этот шаг может быть уже не нужен из-за предварительной сортировки, но оставим для надежности
  columns.sort((colA, colB) => cx(colB[0]) - cx(colA[0]));

  const out: BoundingBox[] = [];
  // 3. Сортируем баблы внутри каждой колонки (сверху вниз) и собираем результат
  for (const col of columns) {
    col.sort((a, b) => a.y1 - b.y1);
    out.push(...col);
  }

  return out;
}

/**

Главная функция: сортирует баблы в порядке чтения манги.
Порядок панелей: сравнение rtlCompareBoxes
Внутри каждой панели: rtlCompareBoxes
Сироты (вне панелей) — в конце, той же сортировкой
*/
export function sortBubblesByPanels(
  bubbles: BoundingBox[],
  panels: PanelRect[]
): BoundingBox[] {
  if (!bubbles || bubbles.length <= 1) return bubbles || [];
  const hasPanels = panels && panels.length > 0;
  if (!hasPanels) {
    return sortBubblesRTL(bubbles);
  }

  const pSorted = sortPanelsRTL(panels);

  // бэкет с баблами по индексу панели
  const map = new Map<number, BoundingBox[]>();
  for (const b of bubbles) {
    const pid = assignBubbleToPanel(b, pSorted);
    if (!map.has(pid)) map.set(pid, []);
    map.get(pid)!.push(b);
  }

  const out: BoundingBox[] = [];
  // по панелям в нужном порядке
  for (let i = 0; i < pSorted.length; i++) {
    const list = map.get(i);
    if (list?.length) out.push(...sortBubblesRTL(list));
  }

  // сироты — в самом конце
  if (map.has(-1)) out.push(...sortBubblesRTL(map.get(-1)!));

  return out;
}
