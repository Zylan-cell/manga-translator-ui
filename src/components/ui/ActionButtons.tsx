import { FunctionalComponent } from "preact";
import { LoadingState } from "../../types";
import {
  AddIcon,
  DeleteIcon,
  DetectIcon,
  EditIcon,
  RecognizeIcon,
  TranslateIcon,
} from "./Icons";

interface ActionButtonsProps {
  imageSrc: string | null;
  isLoading: LoadingState;
  onDetect: () => void;
  onRecognize: () => void;
  onTranslate: () => void;
  onExportImage: () => void;
  onInpaintAuto?: () => void;
  editMode: boolean;
  onToggleEditMode: () => void;
  isAddingBubble: boolean;
  onToggleAddBubble: () => void;
  onDeleteBubble: () => void;
  selectedBubbleId: number | null;
  maskMode: boolean;
  onToggleMaskMode: () => void;
  brushSize: number;
  onBrushSizeChange: (value: number) => void;
  eraseMode: boolean;
  onToggleEraseMode: () => void;
  onApplyInpaint: () => void;
  onClearMask: () => void;
}

const ActionButtons: FunctionalComponent<ActionButtonsProps> = ({
  imageSrc,
  isLoading,
  onDetect,
  onRecognize,
  onTranslate,
  onExportImage,
  onInpaintAuto,
  editMode,
  onToggleEditMode,
  isAddingBubble,
  onToggleAddBubble,
  onDeleteBubble,
  selectedBubbleId,
  maskMode,
  onToggleMaskMode,
  brushSize,
  onBrushSizeChange,
  eraseMode,
  onToggleEraseMode,
  onApplyInpaint,
  onClearMask,
}) => {
  const anyLoading =
    isLoading.detect ||
    isLoading.ocr ||
    isLoading.translate ||
    isLoading.inpaint;

  return (
    <div class="card actions-card">
      <div class="card-header">
        <h2>Actions</h2>
      </div>

      <div class="card-body">
        <div class="btn-group vertical">
          <button
            onClick={onToggleEditMode}
            disabled={!imageSrc || anyLoading}
            class={`btn ${editMode ? "btn-danger" : "btn-primary"}`}
          >
            <EditIcon />{" "}
            {editMode ? "Exit Edit Mode (E)" : "Enter Edit Mode (E)"}
          </button>

          {editMode ? (
            <>
              <button
                onClick={onToggleAddBubble}
                disabled={!imageSrc || anyLoading}
                class={`btn ${isAddingBubble ? "btn-success" : "btn-primary"}`}
              >
                <AddIcon />{" "}
                {isAddingBubble ? "Cancel Adding (Esc)" : "Add Bubble (A)"}
              </button>

              <button
                onClick={onDeleteBubble}
                disabled={!imageSrc || anyLoading || selectedBubbleId === null}
                class="btn btn-danger"
              >
                <DeleteIcon /> Delete Selected (Del)
              </button>

              <div class="translate-action">
                <div class="btn-group">
                  <button
                    onClick={onToggleMaskMode}
                    disabled={!imageSrc || anyLoading}
                    class={`btn ${maskMode ? "btn-success" : "btn-outline"}`}
                    title="Toggle mask drawing mode"
                  >
                    {maskMode ? "Mask Mode: ON" : "Mask Mode"}
                  </button>
                  <button
                    onClick={onToggleEraseMode}
                    disabled={!imageSrc || anyLoading || !maskMode}
                    class={`btn ${eraseMode ? "btn-danger" : "btn-secondary"}`}
                    title="Toggle eraser"
                  >
                    {eraseMode ? "Eraser: ON" : "Eraser"}
                  </button>
                </div>

                <div class="mask-options">
                  <label
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Brush Size
                  </label>
                  <input
                    type="range"
                    min={4}
                    max={64}
                    step={2}
                    value={brushSize}
                    onInput={(e) =>
                      onBrushSizeChange(
                        parseInt((e.target as HTMLInputElement).value, 10)
                      )
                    }
                    class="slider"
                    disabled={!maskMode || anyLoading}
                  />
                  <span
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {brushSize}px
                  </span>
                </div>

                <div class="btn-group">
                  <button
                    onClick={onApplyInpaint}
                    disabled={!imageSrc || anyLoading || !maskMode}
                    class="btn btn-success"
                    title="Apply manual inpaint using the current mask"
                  >
                    Apply Inpaint
                  </button>
                  <button
                    onClick={onClearMask}
                    disabled={!imageSrc || anyLoading}
                    class="btn btn-secondary"
                    title="Clear whole mask"
                  >
                    Erase Mask
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={onDetect}
                disabled={!imageSrc || anyLoading}
                class="btn btn-primary"
              >
                <DetectIcon /> Detect Bubbles (D)
              </button>
              <button
                onClick={onRecognize}
                disabled={!imageSrc || anyLoading}
                class="btn btn-primary"
              >
                <RecognizeIcon /> Recognize Text (R)
              </button>
              <button
                onClick={onTranslate}
                disabled={!imageSrc || anyLoading}
                class="btn btn-primary"
              >
                <TranslateIcon /> Translate Text (T)
              </button>

              {onInpaintAuto && (
                <button
                  onClick={onInpaintAuto}
                  disabled={!imageSrc || anyLoading}
                  class="btn btn-primary"
                  title="Auto inpaint detected text"
                >
                  Inpaint (Auto)
                </button>
              )}
              <button
                onClick={onExportImage}
                disabled={!imageSrc || anyLoading}
                class="btn btn-success"
                title="Export image with translated text"
              >
                Export Image
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActionButtons;
