import { FunctionalComponent } from "preact";
import { LoadingState } from "../../types";
import "./BottomToolbar.css";
import { PlusIcon, TrashIcon, PencilIcon } from "./Icons";

interface BottomToolbarProps {
  imageSrc: string | null;
  isLoading: LoadingState;
  isAddingBubble: boolean;
  onToggleAddBubble: () => void;
  onDeleteBubble: () => void;
  selectedBubbleId: number | null;
  maskMode?: boolean;
  onToggleMaskMode?: () => void;
  onInpaintAuto?: () => void;
  onInpaintManual?: () => void;
  onClearMask?: () => void;
  eraseMode?: boolean;
  onToggleEraseMode?: () => void;
  brushSize?: number;
  onBrushSizeChange?: (size: number) => void;
}

const BottomToolbar: FunctionalComponent<BottomToolbarProps> = ({
  imageSrc,
  isLoading,
  isAddingBubble,
  onToggleAddBubble,
  onDeleteBubble,
  selectedBubbleId,
  maskMode = false,
  onToggleMaskMode,
  onInpaintAuto,
  onInpaintManual,
  onClearMask,
  eraseMode = false,
  onToggleEraseMode,
  brushSize = 20,
  onBrushSizeChange,
}) => {
  const anyLoading = isLoading.detect || isLoading.ocr || isLoading.translate;

  return (
    <div class="bottom-toolbar">
      <div class="toolbar-section">
        <div class="toolbar-group">
          <button
            onClick={onToggleAddBubble}
            disabled={!imageSrc || anyLoading || maskMode}
            class={`toolbar-btn ${isAddingBubble ? "active" : ""}`}
            title="Add Bubble (A)"
          >
            <PlusIcon class="icon" />
            <span>Add Bubble</span>
          </button>
          <button
            onClick={onDeleteBubble}
            disabled={
              !imageSrc || anyLoading || selectedBubbleId === null || maskMode
            }
            class="toolbar-btn danger"
            title="Delete Selected (Del)"
          >
            <TrashIcon class="icon" />
            <span>Delete</span>
          </button>
        </div>
      </div>
      <div class="toolbar-section">
        <div class="toolbar-group">
          {onToggleMaskMode && (
            <button
              onClick={onToggleMaskMode}
              disabled={!imageSrc || anyLoading}
              class={`toolbar-btn ${maskMode ? "active" : ""}`}
              title="Mask Mode"
            >
              <PencilIcon class="icon" />
              <span>Mask Mode</span>
            </button>
          )}
          {maskMode && (
            <>
              {onToggleEraseMode && (
                <button
                  onClick={onToggleEraseMode}
                  disabled={!imageSrc || anyLoading}
                  class={`toolbar-btn ${eraseMode ? "active" : ""}`}
                  title="Toggle Erase Mode"
                >
                  <span>{eraseMode ? "Erase" : "Paint"}</span>
                </button>
              )}
              {onBrushSizeChange && (
                <div class="brush-size-control">
                  <label for="brush-size">Size: {brushSize}px</label>
                  <input
                    id="brush-size"
                    type="range"
                    min="5"
                    max="100"
                    value={brushSize}
                    onInput={(e) =>
                      onBrushSizeChange(
                        Number((e.target as HTMLInputElement).value)
                      )
                    }
                    class="brush-slider"
                  />
                </div>
              )}
              <div class="toolbar-group">
                {onClearMask && (
                  <button
                    onClick={onClearMask}
                    disabled={!imageSrc || anyLoading}
                    class="toolbar-btn outline"
                    title="Clear Mask"
                  >
                    <span>Clear Mask</span>
                  </button>
                )}
                {onInpaintManual && (
                  <button
                    onClick={onInpaintManual}
                    disabled={!imageSrc || anyLoading}
                    class="toolbar-btn primary"
                    title="Inpaint Manual Mask"
                  >
                    <span>Inpaint Manual</span>
                  </button>
                )}
              </div>
            </>
          )}
          {onInpaintAuto && !maskMode && (
            <button
              onClick={onInpaintAuto}
              disabled={!imageSrc || anyLoading || !selectedBubbleId}
              class="toolbar-btn primary"
              title="Inpaint Selected Bubble"
            >
              <span>Inpaint Selected</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BottomToolbar;
