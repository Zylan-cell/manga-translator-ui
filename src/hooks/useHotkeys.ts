import { useEffect } from "preact/hooks";

interface UseHotkeysArgs {
  editMode: boolean;
  isCanvasFullscreen: boolean;
  isAddingBubble: boolean;
  showSettingsModal: boolean;
  toggleEditMode: () => void;
  toggleAddBubble: () => void;
  handleDeleteBubble: () => void;
  handleDetect: () => void;
  recognizeAllBubbles: () => void;
  translateAllBubbles: () => void;
  exitFullscreen: () => void;
  cancelAddBubble: () => void;
  closeSettings: () => void;
  onUndo?: () => void;
}

export function useHotkeys(args: UseHotkeysArgs) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          'input, textarea, select, [contenteditable="true"]'
        )
      )
        return;

      if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") {
        e.preventDefault();
        args.onUndo?.();
        return;
      }

      if (e.code === "KeyE") {
        e.preventDefault();
        args.toggleEditMode();
        return;
      }

      if (args.editMode) {
        if (e.code === "KeyA") {
          e.preventDefault();
          args.toggleAddBubble();
          return;
        }
        if (e.code === "Delete") {
          e.preventDefault();
          args.handleDeleteBubble();
          return;
        }
      } else {
        if (e.code === "KeyD") {
          e.preventDefault();
          args.handleDetect();
          return;
        }
        if (e.code === "KeyR") {
          e.preventDefault();
          args.recognizeAllBubbles();
          return;
        }
        if (e.code === "KeyT") {
          e.preventDefault();
          args.translateAllBubbles();
          return;
        }
      }

      if (e.code === "Escape") {
        if (args.isCanvasFullscreen) args.exitFullscreen();
        if (args.isAddingBubble) args.cancelAddBubble();
        if (args.showSettingsModal) args.closeSettings();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [args]);
}
