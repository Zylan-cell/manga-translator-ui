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
  enableTwoStepTranslation: boolean;
  setEnableTwoStepTranslation: (value: boolean) => void;
  deeplxUrl: string;
  setDeeplxUrl: (url: string) => void;
  streamTranslation: boolean;
  setStreamTranslation: (v: boolean) => void;
  usePanelDetection: boolean;
  setUsePanelDetection: (v: boolean) => void;
}

const Settings: FunctionalComponent<SettingsProps> = ({
  apiBaseUrl,
  setApiBaseUrl,
  translationUrl,
  setTranslationUrl,
  selectedModel,
  setSelectedModel,
  models,
  fetchModels,
  systemPrompt,
  setSystemPrompt,
  enableTwoStepTranslation,
  setEnableTwoStepTranslation,
  deeplxUrl,
  setDeeplxUrl,
  streamTranslation,
  setStreamTranslation,
  usePanelDetection,
  setUsePanelDetection,
}) => {
  return (
    <>
      <h3>API Settings</h3>
      <div class="settings-field">
        <label for="api-base-url">
          Backend API URL (Detection, OCR, Inpaint):
        </label>
        <input
          id="api-base-url"
          type="text"
          value={apiBaseUrl}
          onInput={(e) => setApiBaseUrl((e.target as HTMLInputElement).value)}
          placeholder="http://localhost:8000"
        />
      </div>

      <div class="settings-field">
        <label class="control-toggle-setting">
          <input
            type="checkbox"
            checked={usePanelDetection}
            onChange={(e) =>
              setUsePanelDetection((e.target as HTMLInputElement).checked)
            }
          />
          <span>Use Panel Detection for Sorting</span>
        </label>
        <small
          style={{ color: "var(--text-secondary)", marginTop: "-0.25rem" }}
        >
          Sorts bubbles based on manga panel order. Disable for simpler sorting.
        </small>
      </div>

      <h3>Translation Settings</h3>
      <div class="settings-field">
        <label for="translation-url">Translator URL (e.g., LM Studio):</label>
        <input
          id="translation-url"
          type="text"
          value={translationUrl}
          onInput={(e) =>
            setTranslationUrl((e.target as HTMLInputElement).value)
          }
          placeholder="http://localhost:1234"
        />
      </div>

      <div class="settings-field">
        <label for="model-select">Model:</label>
        <div class="model-select-group">
          <select
            id="model-select"
            value={selectedModel}
            onChange={(e) =>
              setSelectedModel((e.target as HTMLSelectElement).value)
            }
            disabled={models.length === 0}
          >
            {models.length > 0 ? (
              models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))
            ) : (
              <option>No models loaded</option>
            )}
          </select>
          <button class="btn btn-secondary" onClick={fetchModels}>
            Refresh
          </button>
        </div>
      </div>

      <div class="settings-field">
        <label class="control-toggle-setting">
          <input
            type="checkbox"
            checked={streamTranslation}
            onChange={(e) =>
              setStreamTranslation((e.target as HTMLInputElement).checked)
            }
          />
          <span>Enable Real-time Translation (Streaming)</span>
        </label>
      </div>

      <h3>System Prompt</h3>
      <div class="settings-field">
        <label for="system-prompt">
          Instructions for the translation model.
        </label>
        <textarea
          id="system-prompt"
          class="system-prompt-textarea"
          value={systemPrompt}
          onInput={(e) =>
            setSystemPrompt((e.target as HTMLTextAreaElement).value)
          }
          rows={8}
        />
      </div>

      <h3>2-Step Translation (JP → EN → RU)</h3>
      <div class="settings-field">
        <label class="control-toggle-setting">
          <input
            type="checkbox"
            checked={enableTwoStepTranslation}
            onChange={(e) =>
              setEnableTwoStepTranslation(
                (e.target as HTMLInputElement).checked
              )
            }
          />
          <span>Enable 2-Step Translation</span>
        </label>
        <label for="deeplx-url">2nd Step Translator URL (DeepLX):</label>
        <input
          id="deeplx-url"
          type="text"
          value={deeplxUrl}
          onInput={(e) => setDeeplxUrl((e.target as HTMLInputElement).value)}
          placeholder="https://your-deeplx-url/translate"
          disabled={!enableTwoStepTranslation}
        />
      </div>
    </>
  );
};

export default Settings;
