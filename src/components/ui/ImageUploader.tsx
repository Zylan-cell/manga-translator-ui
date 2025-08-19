import { FunctionalComponent } from "preact";
import { useRef, useState, useEffect } from "preact/hooks";

interface ImageUploaderProps {
  onImageUpload: (imageData: string) => void;
}

const ImageUploader: FunctionalComponent<ImageUploaderProps> = ({
  onImageUpload,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleGlobalPaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf("image") !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (e) => {
              const dataUrl = e.target?.result as string;
              if (dataUrl) {
                onImageUpload(dataUrl);
                setError(null);
              }
            };
            reader.onerror = () =>
              setError("Error reading image from clipboard.");
            reader.readAsDataURL(blob);
            break;
          }
        }
      }
    };
    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [onImageUpload]);

  const handleFileChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    processFile(target.files?.[0]);
  };

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    processFile(file);
  };

  const processFile = (file?: File) => {
    if (!file) {
      setError("No file selected");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        onImageUpload(result);
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.onerror = () => setError("Error reading file");
    reader.readAsDataURL(file);
  };

  return (
    <div class="card mb-4 uploader-card">
      <div class="card-header">
        <h2>Upload Image</h2>
      </div>

      <div
        class={`card-body image-placeholder ${dragActive ? "bg-hover" : ""} ${
          error ? "error" : ""
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
        <p class="mt-2">Drag & drop or click to upload</p>
        <p
          class="mt-2"
          style={{
            fontSize: "var(--font-size-sm)",
            color: "var(--text-secondary)",
          }}
        >
          You can also paste from clipboard (Ctrl+V)
        </p>
        {error && <p class="text-danger">{error}</p>}
      </div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        class="hidden"
      />
    </div>
  );
};

export default ImageUploader;
