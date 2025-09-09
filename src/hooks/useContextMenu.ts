// src/hooks/useContextMenu.ts
import { useState } from "preact/hooks";
import type { MenuItem } from "../components/ui/ContextMenu";
import type { DetectedTextItem, ImageInfo } from "../types";
import type { ProgressState } from "../types/ui";

type Args = {
  imageSrc: string | null;
  editMode: boolean;
  isAddingBubble: boolean;
  selectedBoxId: number | null;
  detectedItems: DetectedTextItem[] | null;
  imageList: ImageInfo[];
  progress: ProgressState;

  toggleEditMode: () => void;
  toggleAddBubble: () => void;
  handleDeleteBubble: () => void;
  handleDetect: () => void;
  recognizeAllBubbles: () => void;
  translateAllBubbles: () => void;
  processCurrentAll: () => void;
  processAllImagesAll: () => void;
  handleExportProject: () => void;
  handleImportProject: () => void;
};

export function useContextMenu(args: Args) {
  const [state, setState] = useState({ visible: false, x: 0, y: 0 });
  const openContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    setState({ visible: true, x: e.clientX, y: e.clientY });
  };
  const closeContextMenu = () => setState((p) => ({ ...p, visible: false }));

  const disabledBusy = args.progress.active;
  const hasOcr = !!args.detectedItems?.some(
    (i) => i.ocrText && i.ocrText.trim()
  );
  // Note: hasTranslations check removed since export image function was removed

  const items: MenuItem[] = [
    {
      label: args.editMode ? "Exit Edit Mode" : "Enter Edit Mode",
      shortcut: "E",
      onClick: args.toggleEditMode,
      disabled: !args.imageSrc || disabledBusy,
      separator: false,
    },
    {
      label: args.isAddingBubble ? "Cancel Adding Bubble" : "Add Bubble",
      shortcut: "A",
      onClick: args.toggleAddBubble,
      disabled: !args.imageSrc || !args.editMode || disabledBusy,
      separator: false,
    },
    {
      label: "Delete Selected",
      shortcut: "Del",
      onClick: args.handleDeleteBubble,
      disabled: !args.editMode || args.selectedBoxId === null || disabledBusy,
      separator: false,
    },
    { separator: true as true },
    {
      label: "Detect Bubbles (Current)",
      shortcut: "D",
      onClick: args.handleDetect,
      disabled: !args.imageSrc || args.editMode || disabledBusy,
      separator: false,
    },
    {
      label: "Recognize Text (Current)",
      shortcut: "R",
      onClick: args.recognizeAllBubbles,
      disabled:
        !args.imageSrc ||
        !args.detectedItems?.length ||
        args.editMode ||
        disabledBusy,
      separator: false,
    },
    {
      label: "Translate Text (Current)",
      shortcut: "T",
      onClick: args.translateAllBubbles,
      disabled: !args.imageSrc || !hasOcr || args.editMode || disabledBusy,
      separator: false,
    },
    { separator: true as true },
    {
      label: "Do All: Detect + OCR + Translate (Current)",
      onClick: args.processCurrentAll,
      disabled: !args.imageSrc || args.editMode || disabledBusy,
      separator: false,
    },
    {
      label: "Do All: Detect + OCR + Translate (All Images)",
      onClick: args.processAllImagesAll,
      disabled: !args.imageList.length || args.editMode || disabledBusy,
      separator: false,
    },
    { separator: true as true },
    {
      label: "Export Project",
      onClick: args.handleExportProject,
      disabled: !args.imageList.length || disabledBusy,
      separator: false,
    },
    {
      label: "Import Project",
      onClick: args.handleImportProject,
      disabled: disabledBusy,
      separator: false,
    },
  ];

  return {
    ctxMenu: state,
    openContextMenu,
    closeContextMenu,
    menuItems: items,
  };
}
