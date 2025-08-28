import { FunctionalComponent } from "preact";

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

  ocrEngine: "auto" | "manga" | "rapid" | "easy";
  setOcrEngine: (v: "auto" | "manga" | "rapid" | "easy") => void;
  ocrAutoRotate: boolean;
  setOcrAutoRotate: (v: boolean) => void;

  showCanvasText: boolean;
  setShowCanvasText: (v: boolean) => void;

  deeplOnly: boolean;
  setDeeplOnly: (v: boolean) => void;
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
          <select
            class="select"
            value={p.ocrEngine}
            onChange={(e) =>
              p.setOcrEngine(
                (e.currentTarget as HTMLSelectElement).value as any
              )
            }
          >
            <option value="auto">Auto (MangaOCR + RapidOCR)</option>
            <option value="manga">MangaOCR (Japanese)</option>
            <option value="rapid">RapidOCR (EN only)</option>
            <option value="easy">EasyOCR (experimental)</option>
          </select>
        </div>

        <div class="settings-row">
          <label class="toggle">
            <input
              type="checkbox"
              checked={p.ocrAutoRotate}
              onChange={onCheck(p.setOcrAutoRotate)}
            />
            OCR Auto-rotate (try 0°, 90°, 270°)
          </label>
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
        <h3>DeepLx Mode</h3>

        <div class="settings-field">
          <label class="toggle">
            <input
              type="checkbox"
              checked={p.deeplOnly}
              onChange={(e) => {
                const v = (e.currentTarget as HTMLInputElement).checked;
                p.setDeeplOnly(v);
                if (v) p.setEnableTwoStepTranslation(false);
              }}
            />
            Use DeepL only (skip LLM step)
          </label>
          <small class="hint">
            Translate OCR text directly via DeepLx (source language auto).
          </small>
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
                if (v) p.setDeeplOnly(false);
              }}
              disabled={p.deeplOnly}
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
            disabled={!p.enableTwoStepTranslation || p.deeplOnly}
          />
        </div>
      </section>
      <section class="settings-section">
        <h3>DeepLx Target Language</h3>
        <div class="settings-field">
          <label htmlFor="deepl-target-lang">Target language (ISO code)</label>
          <input
            id="deepl-target-lang"
            type="text"
            class="input"
            value={p.deeplTargetLang}
            onInput={(e) =>
              p.setDeeplTargetLang(
                (e.currentTarget as HTMLInputElement).value.toUpperCase()
              )
            }
            placeholder="RU"
          />
        </div>
      </section>
    </div>
  );
};

export default Settings;
