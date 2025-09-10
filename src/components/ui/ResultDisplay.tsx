import { FunctionalComponent } from "preact";
import { useRef, useState } from "preact/hooks";
import { DetectedTextItem } from "../../types";

interface ResultDisplayProps {
  detectedItems: DetectedTextItem[] | null;
  selectedBoxId: number | null;
  onBoxSelect: (item: DetectedTextItem | null) => void;
  editMode: boolean;
  onReorder: (sourceId: number, targetId: number) => void;
  onUpdateTextFields: (id: number, fields: Partial<DetectedTextItem>) => void;
}

const ResultDisplay: FunctionalComponent<ResultDisplayProps> = ({
  detectedItems,
  selectedBoxId,
  onBoxSelect,
  editMode,
  onReorder,
  onUpdateTextFields,
}) => {
  const list = detectedItems || [];
  const ulRef = useRef<HTMLUListElement>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const onItemClick = (e: MouseEvent, item: DetectedTextItem) => {
    e.stopPropagation();
    onBoxSelect(item.id === selectedBoxId ? null : item);
  };

  const onDragStart = (e: DragEvent, id: number) => {
    setDragId(id);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(id));
    }
  };

  const onListDragOver = (e: DragEvent) => {
    if (dragId === null) return;
    e.preventDefault();
    const ul = ulRef.current;
    if (!ul) return;

    const rows = Array.from(
      ul.querySelectorAll<HTMLLIElement>("li.result-row")
    );
    if (!rows.length) return;

    const y = e.clientY;
    let idx = rows.findIndex((el) => {
      const r = el.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      return y < mid;
    });
    if (idx === -1) idx = rows.length;

    if (idx !== dropIndex) setDropIndex(idx);
  };

  const onListDrop = (e: DragEvent) => {
    e.preventDefault();
    if (dragId !== null && dropIndex !== null) {
      const targetItem = list[dropIndex];
      const targetId = targetItem ? targetItem.id : -1;
      onReorder(dragId, targetId);
    }
    setDropIndex(null);
    setDragId(null);
  };

  const onListDragLeave = () => {
    setDropIndex(null);
  };

  const handleTextChange = (
    id: number,
    field: "ocrText" | "translation",
    value: string
  ) => {
    onUpdateTextFields(id, { [field]: value });
  };

  return (
    <div class="workspace-panel" onClick={() => onBoxSelect(null)}>
      <div class="workspace-panel-content results-panel-content">
        {list.length > 0 ? (
          <ul
            class="results-list"
            ref={ulRef}
            onDragOver={onListDragOver}
            onDrop={onListDrop}
            onDragLeave={onListDragLeave}
          >
            {list.map((item, i) => {
              const isSelected = item.id === selectedBoxId;
              const isDragging = item.id === dragId;
              return (
                <>
                  {dropIndex === i && dragId !== null && (
                    <li class="drop-marker" />
                  )}
                  <li
                    key={item.id}
                    data-id={item.id}
                    class={`result-item result-row ${
                      isSelected ? "selected" : ""
                    } ${isDragging ? "dragging" : ""}`}
                    draggable={editMode}
                    onDragStart={(e) => onDragStart(e, item.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setDropIndex(null);
                    }}
                    onClick={(e) => onItemClick(e, item)}
                  >
                    <div class="result-item-header">
                      <span class="result-item-id">{i + 1}</span>
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

                    <div class="result-item-editor">
                      <div class="editor-field">
                        <label>OCR Text</label>
                        <textarea
                          value={item.ocrText || ""}
                          onInput={(e) =>
                            handleTextChange(
                              item.id,
                              "ocrText",
                              (e.target as HTMLTextAreaElement).value
                            )
                          }
                          onClick={(e) => e.stopPropagation()}
                          rows={3}
                        />
                      </div>
                      <div class="editor-field">
                        <label>Translation</label>
                        <textarea
                          value={item.translation || ""}
                          onInput={(e) =>
                            handleTextChange(
                              item.id,
                              "translation",
                              (e.target as HTMLTextAreaElement).value
                            )
                          }
                          onClick={(e) => e.stopPropagation()}
                          rows={3}
                        />
                      </div>
                    </div>
                  </li>
                </>
              );
            })}
            {dropIndex === list.length && dragId !== null && (
              <li class="drop-marker" />
            )}
          </ul>
        ) : (
          <div class="empty-state-card">
            <p>No results yet. Use actions to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultDisplay;
