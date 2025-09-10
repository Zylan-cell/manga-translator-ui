import { FunctionalComponent } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { DetectedTextItem } from "../../types";
import ResultDisplay from "./ResultDisplay";
import BubbleSettings from "./BubbleSettings";
import "./CombinedRightPanel.css";

interface CombinedRightPanelProps {
  detectedItems: DetectedTextItem[] | null;
  selectedBoxId: number | null;
  onBoxSelect: (item: DetectedTextItem | null) => void;
  editMode: boolean;
  onReorder: (sourceId: number, targetId: number) => void;
  onUpdateTextFields: (id: number, fields: Partial<DetectedTextItem>) => void;
}

/**
 * Правый сайдбар со сплиттером между Bubble Settings и Results.
 * ratio ∈ [0..1] — доля высоты, занимаемая верхней секцией (настройки).
 * При ratio≈0 верхняя секция скрыта, при ratio≈1 скрыта нижняя.
 */
const CombinedRightPanel: FunctionalComponent<CombinedRightPanelProps> = ({
  detectedItems,
  selectedBoxId,
  onBoxSelect,
  editMode,
  onReorder,
  onUpdateTextFields,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState<number>(() => {
    const saved = localStorage.getItem("rightPanelSplitRatio");
    const v = saved ? parseFloat(saved) : 0.66;
    return Number.isFinite(v) ? Math.min(0.99, Math.max(0.01, v)) : 0.66;
  });
  const [dragging, setDragging] = useState(false);

  const selectedItem =
    detectedItems?.find((item) => item.id === selectedBoxId) || null;

  // Сохраняем в localStorage при изменении
  useEffect(() => {
    localStorage.setItem("rightPanelSplitRatio", String(ratio));
  }, [ratio]);

  const onSplitterPointerDown = (e: PointerEvent) => {
    e.preventDefault();
    setDragging(true);
    try {
      containerRef.current?.setPointerCapture(e.pointerId);
    } catch {}
  };

  const onContainerPointerMove = (e: PointerEvent) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const h = rect.height || 1;
    // Вычисляем новую долю
    let r = y / h;
    // Ограничим, но разрешим схлопывание до минимума
    r = Math.max(0, Math.min(1, r));
    setRatio(r);
  };

  const onContainerPointerUp = (e: PointerEvent) => {
    if (!dragging) return;
    setDragging(false);
    try {
      if (
        containerRef.current &&
        containerRef.current.hasPointerCapture(e.pointerId)
      ) {
        containerRef.current.releasePointerCapture(e.pointerId);
      }
    } catch {}
  };

  // Пороги схлопывания
  const TOP_HIDE_THRESHOLD = 0.02; // <2% — скрыть верхнюю секцию
  const BOTTOM_HIDE_THRESHOLD = 0.98; // >98% — скрыть нижнюю секцию

  const topHidden = ratio <= TOP_HIDE_THRESHOLD;
  const bottomHidden = ratio >= BOTTOM_HIDE_THRESHOLD;

  // Стиль секций: используем flex-basis в процентах
  const topStyle = topHidden
    ? { display: "none" }
    : { flex: `0 0 ${Math.round(ratio * 10000) / 100}%` };

  const bottomStyle = bottomHidden
    ? { display: "none" }
    : { flex: `1 1 ${Math.round((1 - ratio) * 10000) / 100}%` };

  return (
    <div
      ref={containerRef}
      class={`combined-right-panel ${dragging ? "resizing" : ""}`}
      onPointerMove={onContainerPointerMove}
      onPointerUp={onContainerPointerUp}
      onPointerCancel={onContainerPointerUp}
      onPointerLeave={(e) => {
        // Если у нас pointer capture — leave не критичен,
        // иначе завершим перетаскивание для безопасности
        if (!containerRef.current?.hasPointerCapture?.(e.pointerId)) {
          setDragging(false);
        }
      }}
    >
      {/* Верхняя секция — Bubble Settings */}
      <div class="panel-section settings-section" style={topStyle as any}>
        <div class="section-header">
          <h3>Bubble Settings</h3>
        </div>
        <div class="section-content">
          <BubbleSettings
            selectedItem={selectedItem}
            onUpdateTextFields={onUpdateTextFields}
          />
        </div>
      </div>

      {/* Разделитель */}
      <div
        class="splitter"
        onPointerDown={onSplitterPointerDown as any}
        title="Drag to resize"
      />

      {/* Нижняя секция — Results */}
      <div class="panel-section results-section" style={bottomStyle as any}>
        <div class="section-header">
          <h3>Results</h3>
        </div>
        <div class="section-content">
          <ResultDisplay
            detectedItems={detectedItems}
            selectedBoxId={selectedBoxId}
            onBoxSelect={onBoxSelect}
            editMode={editMode}
            onReorder={onReorder}
            onUpdateTextFields={onUpdateTextFields}
          />
        </div>
      </div>
    </div>
  );
};

export default CombinedRightPanel;
