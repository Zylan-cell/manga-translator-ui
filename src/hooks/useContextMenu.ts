// src/hooks/useContextMenu.ts
import { useState } from "preact/hooks";
import type { MenuItem } from "../components/ui/ContextMenu";
import type { DetectedTextItem } from "../types";
import type { ProgressState } from "../types/ui";

type Args = {
  imageSrc: string | null;
  detectedItems: DetectedTextItem[] | null;
  progress: ProgressState;
  handleDetect: () => void;
  recognizeAllBubbles: () => void;
  translateAllBubbles: () => void;
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

  const items: MenuItem[] = [
    {
      // ИЗМЕНЕНО: Метка стала более понятной
      label: "Detect Bubbles",
      shortcut: "D",
      onClick: args.handleDetect,
      disabled: !args.imageSrc || disabledBusy,
      separator: false,
    },
    {
      label: "OCR",
      shortcut: "R",
      onClick: args.recognizeAllBubbles,
      disabled: !args.imageSrc || !args.detectedItems?.length || disabledBusy,
      separator: false,
    },
    {
      label: "Translate",
      shortcut: "T",
      onClick: args.translateAllBubbles,
      disabled: !args.imageSrc || !hasOcr || disabledBusy,
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
