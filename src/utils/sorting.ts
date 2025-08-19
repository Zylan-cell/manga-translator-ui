import { BoundingBox } from "../types";

function getIntersectionArea(
  bubble: BoundingBox,
  panel: number[] | [number, number, number, number]
): number {
  const [px1, py1, px2, py2] = panel;
  const { x1, y1, x2, y2 } = bubble;

  const intersectX1 = Math.max(x1, px1);
  const intersectY1 = Math.max(y1, py1);
  const intersectX2 = Math.min(x2, px2);
  const intersectY2 = Math.min(y2, py2);

  const width = intersectX2 - intersectX1;
  const height = intersectY2 - intersectY1;

  return width > 0 && height > 0 ? width * height : 0;
}

function assignBubbleToPanel(
  bubble: BoundingBox,
  sortedPanels: number[][] | [number, number, number, number][]
): number {
  let maxIntersection = 0;
  let bestPanelIndex = -1;

  for (let i = 0; i < sortedPanels.length; i++) {
    const intersection = getIntersectionArea(bubble, sortedPanels[i]);
    if (intersection > maxIntersection) {
      maxIntersection = intersection;
      bestPanelIndex = i;
    }
  }
  return bestPanelIndex;
}

export function sortBubblesByPanels(
  bubbles: BoundingBox[],
  sortedPanels: number[][] | [number, number, number, number][]
): BoundingBox[] {
  if (!sortedPanels || sortedPanels.length === 0) {
    // Простая сортировка сверху вниз, слева направо
    return [...bubbles].sort((a, b) => {
      const yDiff = a.y1 - b.y1;
      if (Math.abs(yDiff) > 10) {
        // Если разница по Y существенна
        return yDiff;
      }
      return a.x1 - b.x1; // Иначе сортируем по X
    });
  }

  const bubblesByPanelId = new Map<number, BoundingBox[]>();
  for (const bubble of bubbles) {
    const panelId = assignBubbleToPanel(bubble, sortedPanels);
    if (!bubblesByPanelId.has(panelId)) {
      bubblesByPanelId.set(panelId, []);
    }
    bubblesByPanelId.get(panelId)!.push(bubble);
  }

  const finalSortedBubbles: BoundingBox[] = [];
  const panelIndices = Array.from(bubblesByPanelId.keys()).sort(
    (a, b) => a - b
  );

  for (const panelId of panelIndices) {
    if (panelId === -1) continue;

    const list = bubblesByPanelId.get(panelId)!;

    // Сортировка внутри панели: справа налево, затем сверху вниз
    list.sort((a, b) => {
      const ax = (a.x1 + a.x2) / 2;
      const bx = (b.x1 + b.x2) / 2;
      const ay = (a.y1 + a.y2) / 2;
      const by = (b.y1 + b.y2) / 2;
      const xTol = Math.min(a.x2 - a.x1, b.x2 - b.x1) * 0.5;

      if (Math.abs(ax - bx) > xTol) return bx - ax;
      return ay - by;
    });
    finalSortedBubbles.push(...list);
  }

  if (bubblesByPanelId.has(-1)) {
    const orphanBubbles = bubblesByPanelId.get(-1)!;
    orphanBubbles.sort((a, b) => a.y1 - b.y1 || b.x1 - a.x1);
    finalSortedBubbles.push(...orphanBubbles);
  }

  return finalSortedBubbles;
}
