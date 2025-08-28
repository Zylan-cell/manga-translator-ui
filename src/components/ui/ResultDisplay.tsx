import { FunctionalComponent } from "preact";
import { useRef, useState } from "preact/hooks";
import { DetectedTextItem } from "../../types";

interface ResultDisplayProps {
  detectedItems: DetectedTextItem[] | null;
  selectedBoxId: number | null;
  onBoxSelect: (item: DetectedTextItem | null) => void;
  editMode: boolean;
  onReorder: (sourceId: number, targetId: number) => void; // targetId === -1 -> в конец
}

const ResultDisplay: FunctionalComponent<ResultDisplayProps> = ({
  detectedItems,
  selectedBoxId,
  onBoxSelect,
  editMode,
  onReorder,
}) => {
  const list = detectedItems || [];
  const ulRef = useRef<HTMLUListElement>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const onItemClick = (e: MouseEvent, item: DetectedTextItem) => {
    e.stopPropagation();
    // Выбор разрешён и в просмотре, и в редактировании
    onBoxSelect(item.id === selectedBoxId ? null : item);
  };

  const onDragStart = (e: DragEvent, id: number) => {
    setDragId(id);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(id));
    }
    const el = e.currentTarget as HTMLElement;
    if (el && e.dataTransfer) {
      const rect = el.getBoundingClientRect();
      const ghost = el.cloneNode(true) as HTMLElement;
      ghost.style.position = "absolute";
      ghost.style.top = "-9999px";
      ghost.style.left = "-9999px";
      ghost.style.width = `${rect.width}px`;
      ghost.classList.add("drag-ghost");
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, rect.width / 2, rect.height / 2);
      setTimeout(() => document.body.removeChild(ghost), 0);
    }
  };

  const onListDragOver = (e: DragEvent) => {
    if (dragId === null) return;
    // Разрешаем drop
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
    // ВАЖНО: здесь НЕ вызываем onReorder — только визуально подсвечиваем место вставки
  };

  const onListDrop = (e: DragEvent) => {
    // Делаем реальный reorder один раз — по факту drop
    e.preventDefault();
    const ul = ulRef.current;
    if (!ul) {
      setDropIndex(null);
      setDragId(null);
      return;
    }
    const rows = Array.from(
      ul.querySelectorAll<HTMLLIElement>("li.result-row")
    );

    if (dragId !== null && dropIndex !== null) {
      let targetId = -1; // -1 = в конец
      if (dropIndex <= 0 && rows.length > 0) {
        targetId = Number(rows[0].dataset.id);
      } else if (dropIndex >= rows.length) {
        targetId = -1; // уже установлен
      } else {
        targetId = Number(rows[dropIndex].dataset.id);
      }
      onReorder(dragId, targetId);
    }

    setDropIndex(null);
    setDragId(null);
  };

  const onListDragLeave = (e: DragEvent) => {
    const ul = ulRef.current;
    if (!ul) return;
    const rect = ul.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      setDropIndex(null);
    }
  };

  return (
    <div class="workspace-panel" onClick={() => onBoxSelect(null)}>
      <div class="workspace-panel-header">
        <h2>Results</h2>
      </div>
      <div class="workspace-panel-content results-panel-content">
        {list.length > 0 ? (
          <ul
            class="results-list"
            ref={ulRef}
            onDragOver={(e) => onListDragOver(e as unknown as DragEvent)}
            onDrop={(e) => onListDrop(e as unknown as DragEvent)}
            onDragLeave={(e) => onListDragLeave(e as unknown as DragEvent)}
          >
            {list.map((item, i) => {
              const isSelectedForView = item.id === selectedBoxId;
              const dragging = item.id === dragId;
              return (
                <>
                  {dropIndex === i && dragId !== null && (
                    <li class="drop-marker" />
                  )}
                  <li
                    key={item.id}
                    data-id={item.id}
                    class={`result-item result-row ${
                      isSelectedForView ? "selected" : ""
                    } ${dragging ? "dragging" : ""}`}
                    draggable={editMode}
                    onDragStart={(e) =>
                      onDragStart(e as unknown as DragEvent, item.id)
                    }
                    onDragEnd={() => {
                      setDragId(null);
                      setDropIndex(null);
                    }}
                    onClick={(e) =>
                      onItemClick(e as unknown as MouseEvent, item)
                    }
                  >
                    <div class="result-item-header">
                      <span class="result-item-id">{i + 1}</span>
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
                </>
              );
            })}
            {dropIndex === list.length && dragId !== null && (
              <li class="drop-marker" />
            )}
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
