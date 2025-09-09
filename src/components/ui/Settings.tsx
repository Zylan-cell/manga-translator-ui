import { FunctionalComponent } from "preact";

// Language options with native names - DeepL supported languages
const LANGUAGE_OPTIONS = [
  { code: "AR", name: "العربية" },
  { code: "BG", name: "Български" },
  { code: "CS", name: "Čeština" },
  { code: "DA", name: "Dansk" },
  { code: "DE", name: "Deutsch" },
  { code: "EL", name: "Ελληνικά" },
  { code: "EN", name: "English" },
  { code: "ES", name: "Español" },
  { code: "ET", name: "Eesti" },
  { code: "FI", name: "Suomi" },
  { code: "FR", name: "Français" },
  { code: "HU", name: "Magyar" },
  { code: "ID", name: "Bahasa Indonesia" },
  { code: "IT", name: "Italiano" },
  { code: "JA", name: "日本語" },
  { code: "KO", name: "한국어" },
  { code: "LT", name: "Lietuvių" },
  { code: "LV", name: "Latviešu" },
  { code: "NB", name: "Norsk (Bokmål)" },
  { code: "NL", name: "Nederlands" },
  { code: "PL", name: "Polski" },
  { code: "PT", name: "Português" },
  { code: "RO", name: "Română" },
  { code: "RU", name: "Русский" },
  { code: "SK", name: "Slovenčina" },
  { code: "SL", name: "Slovenščina" },
  { code: "SV", name: "Svenska" },
  { code: "TR", name: "Türkçe" },
  { code: "UK", name: "Українська" },
  { code: "ZH", name: "中文" },
];

interface SettingsProps {
  apiBaseUrl: string;
  setApiBaseUrl: (url: string) => void;
  translationUrl: string;
  setTranslationUrl: (url: string) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  models: string[];
  fetchModels: () => void;
  systemPrompt: string;
  setSystemPrompt: (prompt: string) => void;

  usePanelDetection: boolean;
  setUsePanelDetection: (v: boolean) => void;
  streamTranslation: boolean;
  setStreamTranslation: (v: boolean) => void;

  enableTwoStepTranslation: boolean;
  setEnableTwoStepTranslation: (v: boolean) => void;
  deeplxUrl: string;
  setDeeplxUrl: (url: string) => void;

  ocrEngine: "manga";
  setOcrEngine: (v: "manga") => void;
  showCanvasText: boolean;
  setShowCanvasText: (v: boolean) => void;

  deeplTargetLang: string;
  setDeeplTargetLang: (v: string) => void;
}

const Settings: FunctionalComponent<SettingsProps> = (p) => {
  const onTextInput = (fn: (v: string) => void) => (e: Event) =>
    fn((e.currentTarget as HTMLInputElement | HTMLTextAreaElement).value);

  const onCheck = (fn: (v: boolean) => void) => (e: Event) =>
    fn((e.currentTarget as HTMLInputElement).checked);

  return (
    <div class="settings-modal-body">
      {" "}
      <section class="settings-section">
        <h3>API Settings</h3>
        <div class="settings-field">
          <label for="api-base-url">Backend API URL</label>
          <input
            id="api-base-url"
            type="text"
            class="input"
            value={p.apiBaseUrl}
            onInput={onTextInput(p.setApiBaseUrl)}
            placeholder="http://localhost:8000"
          />
          <small class="hint">
            Used for detection, OCR and inpaint services.
          </small>
        </div>

        <div class="settings-field">
          <label class="toggle">
            <input
              type="checkbox"
              checked={p.usePanelDetection}
              onChange={onCheck(p.setUsePanelDetection)}
            />
            Use Panel Detection for Sorting
          </label>
          <small class="hint">
            Sort bubbles by manga panel order. Disable for simpler top-to-bottom
            sorting.
          </small>
        </div>
      </section>
      <section class="settings-section">
        <h3>OCR Settings</h3>

        <div class="settings-field">
          <label>OCR Engine</label>
          <div class="input-like-display">MangaOCR (Japanese)</div>
          <small class="hint">
            Using MangaOCR for Japanese text recognition.
          </small>
        </div>

        <div class="settings-field">
          <label class="toggle">
            <input
              type="checkbox"
              checked={p.showCanvasText}
              onChange={onCheck(p.setShowCanvasText)}
            />
            Show translated text on canvas
          </label>
        </div>
      </section>
      <section class="settings-section">
        <h3>Translation Settings</h3>

        <div class="settings-field">
          <label for="translation-url">Translator URL (e.g., LM Studio)</label>
          <input
            id="translation-url"
            type="text"
            class="input"
            value={p.translationUrl}
            onInput={onTextInput(p.setTranslationUrl)}
            placeholder="http://localhost:1234"
          />
        </div>

        <div class="settings-field">
          <label>Model</label>
          <div class="model-select-group">
            <select
              class="select"
              value={p.selectedModel}
              onChange={(e) =>
                p.setSelectedModel((e.currentTarget as HTMLSelectElement).value)
              }
              disabled={p.models.length === 0}
            >
              {p.models.length ? (
                p.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))
              ) : (
                <option>No models loaded</option>
              )}
            </select>
            <button class="btn btn-secondary" onClick={p.fetchModels}>
              Refresh
            </button>
          </div>
        </div>

        <div class="settings-field">
          <label class="toggle">
            <input
              type="checkbox"
              checked={p.streamTranslation}
              onChange={onCheck(p.setStreamTranslation)}
            />
            Enable Real-time Translation (Streaming)
          </label>
        </div>
      </section>
      <section class="settings-section">
        <h3>System Prompt</h3>
        <div class="settings-field">
          <label htmlFor="system-prompt">
            Instructions for the translation model
          </label>
          <textarea
            id="system-prompt"
            class="textarea system-prompt-textarea"
            value={p.systemPrompt}
            onInput={onTextInput(p.setSystemPrompt)}
          />
        </div>
      </section>
      <section class="settings-section">
        <h3>2-Step Translation (JP → EN → DeepLx)</h3>

        <div class="settings-field">
          <label class="toggle">
            <input
              type="checkbox"
              checked={p.enableTwoStepTranslation}
              onChange={(e) => {
                const v = (e.currentTarget as HTMLInputElement).checked;
                p.setEnableTwoStepTranslation(v);
              }}
            />
            Enable 2-Step Translation
          </label>
        </div>

        <div class="settings-field">
          <label htmlFor="deeplx-url">2nd Step Translator URL (DeepLX)</label>
          <input
            id="deeplx-url"
            type="text"
            class="input"
            value={p.deeplxUrl}
            onInput={onTextInput(p.setDeeplxUrl)}
            placeholder="https://your-deeplx-url/translate"
            disabled={!p.enableTwoStepTranslation}
          />
        </div>
      </section>
      <section class="settings-section">
        <h3>DeepLx Target Language</h3>
        <div class="settings-field">
          <label htmlFor="deepl-target-lang">Target language</label>
          <select
            id="deepl-target-lang"
            class="input"
            value={p.deeplTargetLang}
            onChange={(e) =>
              p.setDeeplTargetLang((e.currentTarget as HTMLSelectElement).value)
            }
          >
            {LANGUAGE_OPTIONS.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
          <small class="hint">
            Select the target language for translation.
          </small>
        </div>
      </section>
    </div>
  );
};

export default Settings;
