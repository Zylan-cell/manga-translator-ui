// src/components/ui/ContextMenu.tsx
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import "./ContextMenu.css";

export type MenuItem =
  | { separator: true }
  | {
      label: string;
      onClick?: () => void;
      disabled?: boolean;
      shortcut?: string;
      separator?: false;
    };

interface Props {
  x: number;
  y: number;
  visible: boolean;
  items: MenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, visible, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    if (!visible) return;
    const el = ref.current;
    if (!el) return;
    const { innerWidth: vw, innerHeight: vh } = window;
    const rect = el.getBoundingClientRect();
    let left = x;
    let top = y;
    const pad = 8;

    if (left + rect.width + pad > vw)
      left = Math.max(pad, vw - rect.width - pad);
    if (top + rect.height + pad > vh)
      top = Math.max(pad, vh - rect.height - pad);

    setPos({ left, top });
  }, [visible, x, y]);

  useEffect(() => {
    if (!visible) return;
    const onAny = () => onClose();
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    setTimeout(() => {
      document.addEventListener("click", onAny, { once: true });
      document.addEventListener("contextmenu", onAny, { once: true });
      document.addEventListener("keydown", onEsc, { once: true });
    }, 0);
    return () => {
      document.removeEventListener("click", onAny);
      document.removeEventListener("contextmenu", onAny);
      document.removeEventListener("keydown", onEsc);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      ref={ref}
      class="context-menu"
      style={{
        left: `${pos.left}px`,
        top: `${pos.top}px`,
        maxHeight: "60vh",
        overflowY: "auto",
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, i) =>
        "separator" in it && it.separator ? (
          <div key={`sep-${i}`} class="context-sep" />
        ) : (
          <button
            key={`mi-${i}`}
            class="context-item"
            disabled={!!it.disabled}
            onClick={() => {
              it.onClick?.();
              onClose();
            }}
          >
            <span>{it.label}</span>
            {"shortcut" in it && it.shortcut && <kbd>{it.shortcut}</kbd>}
          </button>
        )
      )}
    </div>
  );
}
