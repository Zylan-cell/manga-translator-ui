import { FunctionalComponent } from "preact";
import { useRef } from "preact/hooks";

interface TopMenuProps {
  onImageUpload: (imageData: string) => void;
  onMultipleImageUpload: (imageDataList: string[], names: string[]) => void;
  onBatchProcess: () => void;
  onShowSettings: () => void;
  hasImages: boolean;
  isProcessing: boolean;
  batchProgress?: {
    currentStep: string | null;
    processedCount: number;
    totalCount: number;
  };
}

const TopMenu: FunctionalComponent<TopMenuProps> = ({
  onImageUpload,
  onMultipleImageUpload,
  onBatchProcess,
  onShowSettings,
  hasImages,
  isProcessing,
  batchProgress,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter((f) =>
      f.type.startsWith("image/")
    );

    if (imageFiles.length === 0) return;

    const readers = imageFiles.map((file) => {
      return new Promise<{ dataUrl: string; name: string }>(
        (resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result as string;
            if (result) {
              resolve({ dataUrl: result, name: file.name });
            } else {
              reject(new Error(`Failed to read ${file.name}`));
            }
          };
          reader.onerror = () =>
            reject(new Error(`Error reading ${file.name}`));
          reader.readAsDataURL(file);
        }
      );
    });

    Promise.all(readers)
      .then((results) => {
        const dataUrls = results.map((r) => r.dataUrl);
        const names = results.map((r) => r.name);

        if (imageFiles.length > 1) {
          onMultipleImageUpload(dataUrls, names);
        } else {
          onImageUpload(dataUrls[0]);
        }
      })
      .catch((err) => {
        console.error("Failed to process images:", err);
      });
  };

  return (
    <div class="top-menu">
      <div class="top-menu-left">
        <button
          class="top-menu-btn btn-primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
        >
          📁 Import Images
        </button>

        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) =>
            handleFileSelect((e.target as HTMLInputElement).files)
          }
          accept="image/*"
          multiple
          style={{ display: "none" }}
        />
      </div>

      <div class="top-menu-center">
        {isProcessing && batchProgress ? (
          <div class="batch-progress-display">
            <h2>Processing Images...</h2>
            <p>
              {batchProgress.currentStep === "detect" && "Detecting Bubbles"}
              {batchProgress.currentStep === "ocr" && "Recognizing Text"}
              {batchProgress.currentStep === "translate" && "Translating"}:{" "}
              {batchProgress.processedCount}/{batchProgress.totalCount}
            </p>
            <div class="progress-bar">
              <div
                class="progress-fill"
                style={{
                  width: `${
                    (batchProgress.processedCount / batchProgress.totalCount) *
                    100
                  }%`,
                }}
              />
            </div>
          </div>
        ) : (
          <h1>Manga Translator</h1>
        )}
      </div>

      <div class="top-menu-right">
        <button
          class="top-menu-btn btn-success"
          onClick={onBatchProcess}
          disabled={!hasImages || isProcessing}
          title="Process all images: detect bubbles, recognize text, and translate"
        >
          ⚙️ {isProcessing ? "Processing..." : "Process All Images"}
        </button>

        <button
          class="top-menu-btn btn-settings"
          onClick={onShowSettings}
          title="Settings"
        >
          ⚙️
        </button>
      </div>
    </div>
  );
};

export default TopMenu;
