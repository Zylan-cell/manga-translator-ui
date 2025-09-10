import { FunctionalComponent } from "preact";
import { useEffect, useState, useMemo } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import {
  DetectedTextItem,
  TextProperties,
  DEFAULT_TEXT_PROPERTIES,
} from "../../types";
import { BoldIcon, ItalicIcon, UnderlineIcon } from "./Icons"; // Импортируем новые иконки
import "./BubbleSettings.css";

function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: number;
  return (...args: Parameters<F>): void => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), waitFor);
  };
}

interface BubbleSettingsProps {
  selectedItem: DetectedTextItem | null;
  onUpdateTextFields: (id: number, fields: Partial<DetectedTextItem>) => void;
}

const BubbleSettings: FunctionalComponent<BubbleSettingsProps> = ({
  selectedItem,
  onUpdateTextFields,
}) => {
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [localTextProps, setLocalTextProps] = useState<TextProperties | null>(
    null
  );

  useEffect(() => {
    invoke<string[]>("get_system_fonts")
      .then(setSystemFonts)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedItem) {
      setLocalTextProps(selectedItem.textProperties || DEFAULT_TEXT_PROPERTIES);
    } else {
      setLocalTextProps(null);
    }
  }, [selectedItem]);

  const debouncedUpdate = useMemo(
    () =>
      debounce((id: number, props: TextProperties) => {
        onUpdateTextFields(id, { textProperties: props });
      }, 250),
    [onUpdateTextFields]
  );

  const handlePropertyChange = (property: keyof TextProperties, value: any) => {
    if (!localTextProps || !selectedItem) return;
    const newProps = { ...localTextProps, [property]: value };
    setLocalTextProps(newProps);
    debouncedUpdate(selectedItem.id, newProps);
  };

  // Обработчики для кнопок-переключателей
  const toggleBold = () => {
    const currentWeight = localTextProps?.fontWeight;
    handlePropertyChange(
      "fontWeight",
      currentWeight === "bold" ? "normal" : "bold"
    );
  };

  const toggleItalic = () => {
    const currentStyle = localTextProps?.fontStyle;
    handlePropertyChange(
      "fontStyle",
      currentStyle === "italic" ? "normal" : "italic"
    );
  };

  const toggleUnderline = () => {
    const currentDecoration = localTextProps?.textDecoration;
    handlePropertyChange(
      "textDecoration",
      currentDecoration === "underline" ? "none" : "underline"
    );
  };

  if (!selectedItem || !localTextProps) {
    return (
      <div class="bubble-settings">
        <div class="no-selection">
          <p>Select a bubble to edit its properties</p>
        </div>
      </div>
    );
  }

  return (
    <div class="bubble-settings">
      <div class="settings-content">
        <div class="setting-group">
          <label class="setting-label">Font Family</label>
          <select
            class="setting-input"
            value={localTextProps.fontFamily}
            onChange={(e) =>
              handlePropertyChange(
                "fontFamily",
                (e.target as HTMLSelectElement).value
              )
            }
          >
            {systemFonts.map((font) => (
              <option key={font} value={font} style={{ fontFamily: font }}>
                {font}
              </option>
            ))}
          </select>
        </div>

        <div class="setting-group">
          <label class="setting-label">Font Size</label>
          <input
            type="number"
            class="setting-input"
            value={localTextProps.fontSize}
            min="8"
            max="150"
            onInput={(e) =>
              handlePropertyChange(
                "fontSize",
                parseInt((e.target as HTMLInputElement).value)
              )
            }
          />
        </div>

        {/* ИЗМЕНЕНИЕ: Новая панель для стилей текста */}
        <div class="setting-group">
          <label class="setting-label">Style</label>
          <div class="style-toggle-group">
            <button
              class={`style-btn ${
                localTextProps.fontWeight === "bold" ? "active" : ""
              }`}
              onClick={toggleBold}
              title="Bold"
            >
              <BoldIcon class="icon" />
            </button>
            <button
              class={`style-btn ${
                localTextProps.fontStyle === "italic" ? "active" : ""
              }`}
              onClick={toggleItalic}
              title="Italic"
            >
              <ItalicIcon class="icon" />
            </button>
            <button
              class={`style-btn ${
                localTextProps.textDecoration === "underline" ? "active" : ""
              }`}
              onClick={toggleUnderline}
              title="Underline"
            >
              <UnderlineIcon class="icon" />
            </button>
          </div>
        </div>

        <div class="setting-group">
          <label class="setting-label">Text Color</label>
          <input
            type="color"
            class="setting-input color-input"
            value={localTextProps.color}
            onInput={(e) =>
              handlePropertyChange(
                "color",
                (e.target as HTMLInputElement).value
              )
            }
          />
        </div>

        <div class="setting-group">
          <label class="setting-label">Stroke Color</label>
          <input
            type="color"
            class="setting-input color-input"
            value={localTextProps.strokeColor}
            onInput={(e) =>
              handlePropertyChange(
                "strokeColor",
                (e.target as HTMLInputElement).value
              )
            }
          />
        </div>

        <div class="setting-group">
          <label class="setting-label">Stroke Width</label>
          <input
            type="number"
            class="setting-input"
            value={localTextProps.strokeWidth}
            min="0"
            max="10"
            step="0.5"
            onInput={(e) =>
              handlePropertyChange(
                "strokeWidth",
                parseFloat((e.target as HTMLInputElement).value)
              )
            }
          />
        </div>
      </div>
    </div>
  );
};

export default BubbleSettings;
