import { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import { DetectedTextItem } from "../../types";

interface ResultDisplayProps {
  detectedItems: DetectedTextItem[] | null;
  selectedBoxId: number | null;
  onBoxSelect: (item: DetectedTextItem | null) => void;
  editMode: boolean;
  onReorder: (sourceId: number, targetId: number) => void;
}

const ResultDisplay: FunctionalComponent<ResultDisplayProps> = ({
  detectedItems,
  selectedBoxId,
  onBoxSelect,
  editMode,
  onReorder,
}) => {
  const [swapSourceId, setSwapSourceId] = useState<number | null>(null);

  const handleItemClick = (e: MouseEvent, item: DetectedTextItem) => {
    e.stopPropagation();

    if (editMode) {
      if (swapSourceId === null) {
        setSwapSourceId(item.id);
      } else if (swapSourceId === item.id) {
        setSwapSourceId(null);
      } else {
        onReorder(swapSourceId, item.id);
        setSwapSourceId(null);
      }
    } else {
      onBoxSelect(item.id === selectedBoxId ? null : item);
    }
  };

  const handleContainerClick = () => {
    if (swapSourceId !== null) {
      setSwapSourceId(null);
    }
  };

  return (
    <div class="workspace-panel" onClick={handleContainerClick}>
      <div class="workspace-panel-header">
        <h2>
          Results {editMode && swapSourceId && `(Swapping #${swapSourceId})`}
        </h2>
      </div>
      <div class="workspace-panel-content results-panel-content">
        {detectedItems && detectedItems.length > 0 ? (
          <ul class="results-list">
            {detectedItems.map((item) => {
              const isSelectedForView = item.id === selectedBoxId && !editMode;
              const isSelectedForSwap = item.id === swapSourceId;

              return (
                <li
                  key={item.id}
                  class={
                    `result-item ` +
                    `${isSelectedForView ? "selected" : ""} ` +
                    `${isSelectedForSwap ? "swap-source" : ""} ` +
                    `${editMode ? "editable-item" : ""}`
                  }
                  onClick={(e) => handleItemClick(e, item)}
                >
                  <div class="result-item-header">
                    <span class="result-item-id">{item.id}</span>
                    <span class="result-item-title">
                      {item.ocrText
                        ? `"${item.ocrText.substring(0, 20)}..."`
                        : "Detected Area"}
                    </span>
                    <span
                      class={`badge ${
                        item.translation
                          ? "badge-success"
                          : item.ocrText
                          ? "badge-primary"
                          : "badge-secondary"
                      }`}
                    >
                      {item.translation
                        ? "Translated"
                        : item.ocrText
                        ? "Recognized"
                        : "Detected"}
                    </span>
                  </div>

                  {item.translation && (
                    <div class="result-item-content">
                      <strong>Translation:</strong> {item.translation}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div class="empty-state-card">
            <p>
              No results yet. Upload an image and use the actions to get
              started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultDisplay;
