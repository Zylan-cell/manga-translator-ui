import { useEffect } from "preact/hooks";

interface UseHotkeysArgs {
  editMode: boolean;
  isAddingBubble: boolean;
  showSettingsModal: boolean;
  toggleAddBubble: () => void;
  handleDeleteBubble: () => void;
  handleDetect: () => void;
  recognizeAllBubbles: () => void;
  translateAllBubbles: () => void;
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
      }

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

      // ИЗМЕНЕНИЕ: Убрана логика для полноэкранного режима
      if (e.code === "Escape") {
        if (args.isAddingBubble) args.cancelAddBubble();
        if (args.showSettingsModal) args.closeSettings();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [args]);
}
