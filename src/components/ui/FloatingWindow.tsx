import { useState, useEffect, useRef } from "preact/hooks";
import { DetectedTextItem, FloatingWindowSettings } from "../../types";

interface FloatingWindowProps {
  position: { x: number; y: number };
  settings: FloatingWindowSettings;
  detectedItems: DetectedTextItem[] | null;
  selectedBoxId: number | null;
  onPositionUpdate: (x: number, y: number) => void;
  onSettingsUpdate: (settings: FloatingWindowSettings) => void;
  onClose: () => void;
  editMode?: boolean;
  onUpdateText?: (id: number, fields: Partial<DetectedTextItem>) => void;
}

export default function FloatingWindow({
  position,
  settings,
  detectedItems,
  selectedBoxId,
  onPositionUpdate,
  onSettingsUpdate,
  onClose,
  editMode = false,
  onUpdateText,
}: FloatingWindowProps) {
  const [localPosition, setLocalPosition] = useState(position);
  const [, setIsDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const selectedItem =
    selectedBoxId !== null && detectedItems
      ? detectedItems.find((item) => item.id === selectedBoxId)
      : null;

  useEffect(() => {
    setLocalPosition(position);
  }, [position]);

  const handleMouseDown = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest(".floating-window-header")) {
      setIsDragging(true);
      dragOffsetRef.current = {
        x: e.clientX - localPosition.x,
        y: e.clientY - localPosition.y,
      };
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    const newPosition = {
      x: e.clientX - dragOffsetRef.current.x,
      y: e.clientY - dragOffsetRef.current.y,
    };
    setLocalPosition(newPosition);
    onPositionUpdate(newPosition.x, newPosition.y);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  const toggleOcr = () =>
    onSettingsUpdate({ ...settings, showOcr: !settings.showOcr });
  const toggleTranslation = () =>
    onSettingsUpdate({
      ...settings,
      showTranslation: !settings.showTranslation,
    });

  if (!selectedItem) return null;

  return (
    <div
      className="floating-window"
      style={{ left: `${localPosition.x}px`, top: `${localPosition.y}px` }}
      onMouseDown={handleMouseDown}
    >
      <div className="floating-window-header">
        <span>Bubble #{selectedItem.id}</span>
        <div className="floating-window-controls">
          <label className="control-toggle">
            <input
              type="checkbox"
              checked={settings.showOcr}
              onChange={toggleOcr}
            />{" "}
            OCR
          </label>
          <label className="control-toggle">
            <input
              type="checkbox"
              checked={settings.showTranslation}
              onChange={toggleTranslation}
            />{" "}
            Translation
          </label>
          <button
            className="close-button"
            onClick={onClose}
            title="Close Window"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="floating-window-content">
        {settings.showOcr && (
          <div className="ocr-section">
            <h4>OCR Text:</h4>
            {editMode ? (
              <textarea
                value={selectedItem.ocrText || ""}
                onInput={(e) =>
                  onUpdateText?.(selectedItem.id, {
                    ocrText: (e.target as HTMLTextAreaElement).value,
                  })
                }
                rows={4}
              />
            ) : (
              <p>{selectedItem.ocrText || "No recognized text"}</p>
            )}
          </div>
        )}

        {settings.showTranslation && (
          <div className="translation-section">
            <h4>Translation:</h4>
            {editMode ? (
              <textarea
                value={selectedItem.translation || ""}
                onInput={(e) =>
                  onUpdateText?.(selectedItem.id, {
                    translation: (e.target as HTMLTextAreaElement).value,
                  })
                }
                rows={4}
              />
            ) : (
              <p>{selectedItem.translation || "No translation"}</p>
            )}
          </div>
        )}

        {!settings.showOcr && !settings.showTranslation && (
          <p className="no-content">Select what to show</p>
        )}
      </div>
    </div>
  );
}
