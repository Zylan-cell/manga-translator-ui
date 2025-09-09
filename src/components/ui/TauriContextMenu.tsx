import { useEffect, useRef } from "preact/hooks";
import { listen } from "@tauri-apps/api/event";
import { Menu } from "@tauri-apps/api/menu";

interface ContextMenuActions {
  onDetect: () => void;
  onRecognize: () => void;
  onTranslate: () => void;
  onRemove: () => void;
}

export const useTauriContextMenu = (
  actions: ContextMenuActions,
  isProcessing: boolean = false
) => {
  const menuRef = useRef<any>(null);
  const unlistenRef = useRef<any>(null);

  useEffect(() => {
    const setupMenu = async () => {
      try {
        // Create context menu
        const menu = await Menu.new({
          items: [
            {
              id: "ctx_detect",
              text: "🔍 Detect Bubbles",
              enabled: !isProcessing,
            },
            {
              id: "ctx_ocr",
              text: "📝 Recognize Text",
              enabled: !isProcessing,
            },
            {
              id: "ctx_translate",
              text: "🌐 Translate",
              enabled: !isProcessing,
            },
            { id: "separator1", text: "", enabled: false }, // Separator
            {
              id: "ctx_remove",
              text: "🗑️ Remove",
              enabled: !isProcessing,
            },
          ],
        });

        // Listen for menu events
        const unlisten = await listen<string>("menu-event", (event) => {
          if (!event.payload.startsWith("ctx")) return;

          switch (event.payload) {
            case "ctx_detect":
              actions.onDetect();
              break;
            case "ctx_ocr":
              actions.onRecognize();
              break;
            case "ctx_translate":
              actions.onTranslate();
              break;
            case "ctx_remove":
              actions.onRemove();
              break;
            default:
              console.log("Unimplemented menu id:", event.payload);
          }
        });

        menuRef.current = menu;
        unlistenRef.current = unlisten;
      } catch (error) {
        console.error("Failed to setup context menu:", error);
      }
    };

    setupMenu();

    // Cleanup on unmount
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
      }
    };
  }, [actions, isProcessing]);

  const showContextMenu = async (event: MouseEvent) => {
    event.preventDefault();

    try {
      if (menuRef.current) {
        await menuRef.current.popup();
      }
    } catch (error) {
      console.error("Failed to show context menu:", error);
    }
  };

  return { showContextMenu };
};
