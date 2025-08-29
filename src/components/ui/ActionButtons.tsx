import { FunctionalComponent } from "preact";
import { LoadingState } from "../../types";
import AddIcon from "../../assets/icons/add.svg?react";
import DeleteIcon from "../../assets/icons/delete.svg?react";
import DetectIcon from "../../assets/icons/detect.svg?react";
import EditIcon from "../../assets/icons/edit.svg?react";
import RecognizeIcon from "../../assets/icons/recognize.svg?react";
import TranslateIcon from "../../assets/icons/translate.svg?react";

interface ActionButtonsProps {
  imageSrc: string | null;
  isLoading: LoadingState;
  onDetect: () => void;
  onRecognize: () => void;
  onTranslate: () => void;
  onExportImage: () => void;
  editMode: boolean;
  onToggleEditMode: () => void;
  isAddingBubble: boolean;
  onToggleAddBubble: () => void;
  onDeleteBubble: () => void;
  selectedBubbleId: number | null;
}

const ActionButtons: FunctionalComponent<ActionButtonsProps> = ({
  imageSrc,
  isLoading,
  onDetect,
  onRecognize,
  onTranslate,
  onExportImage,
  editMode,
  onToggleEditMode,
  isAddingBubble,
  onToggleAddBubble,
  onDeleteBubble,
  selectedBubbleId,
}) => {
  const anyLoading = isLoading.detect || isLoading.ocr || isLoading.translate;

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
            <EditIcon class="icon" />{" "}
            {editMode ? "Exit Edit Mode (E)" : "Enter Edit Mode (E)"}
          </button>

          {editMode ? (
            <>
              <button
                onClick={onToggleAddBubble}
                disabled={!imageSrc || anyLoading}
                class={`btn ${isAddingBubble ? "btn-success" : "btn-primary"}`}
              >
                <AddIcon class="icon" />{" "}
                {isAddingBubble ? "Cancel Adding (Esc)" : "Add Bubble (A)"}
              </button>

              <button
                onClick={onDeleteBubble}
                disabled={!imageSrc || anyLoading || selectedBubbleId === null}
                class="btn btn-danger"
              >
                <DeleteIcon class="icon" /> Delete Selected (Del)
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onDetect}
                disabled={!imageSrc || anyLoading}
                class="btn btn-primary"
              >
                <DetectIcon class="icon" /> Detect Bubbles (D)
              </button>
              <button
                onClick={onRecognize}
                disabled={!imageSrc || anyLoading}
                class="btn btn-primary"
              >
                <RecognizeIcon class="icon" /> Recognize Text (R)
              </button>
              <button
                onClick={onTranslate}
                disabled={!imageSrc || anyLoading}
                class="btn btn-primary"
              >
                <TranslateIcon class="icon" /> Translate Text (T)
              </button>
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
