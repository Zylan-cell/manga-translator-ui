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

  // Превращаем Blob -> DataURL и отдаём наверх
  const processBlob = (blob?: Blob) => {
    if (!blob) return;
    if (!blob.type.startsWith("image/")) {
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
    reader.readAsDataURL(blob);
  };

  // Попытка скачать картинку обычным fetch (может упасть из-за CORS)
  const tryFetchAsBlob = async (url: string): Promise<Blob> => {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const buf = await res.arrayBuffer();
    return new Blob([buf]);
  };

  // Фоллбек: через Rust-команду (если добавлена) — обходит CORS/хотлинк
  const tryFetchViaTauri = async (url: string): Promise<Blob> => {
    // динамический импорт, чтобы не тянуть лишнего в бандл, если не понадобится
    const { invoke } = await import("@tauri-apps/api/core");
    const b64 = await invoke<string>("fetch_image", { url });
    // декодируем base64 → Uint8Array → Blob
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8.buffer]);
  };

  const extractUrlFromUriList = (text: string): string | null => {
    const lines = text.split(/\r?\n/).map((l) => l.trim());
    for (const line of lines) {
      if (!line || line.startsWith("#")) continue;
      return line;
    }
    return null;
  };

  const extractImgSrcFromHtml = (html: string): string | null => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const img = doc.querySelector("img");
    return img?.src || null;
  };

  // Универсальная обработка DataTransfer (drop из браузера/проводника)
  const handleDataTransfer = async (dt: DataTransfer): Promise<boolean> => {
    // 1) Файлы напрямую
    if (dt.files && dt.files.length > 0) {
      const file =
        Array.from(dt.files).find((f) => f.type.startsWith("image/")) ||
        dt.files[0];
      processBlob(file);
      return true;
    }

    // 2) items как file
    if (dt.items && dt.items.length > 0) {
      const fileItem = Array.from(dt.items).find(
        (it) => it.kind === "file" && it.type.startsWith("image/")
      );
      if (fileItem) {
        const file = fileItem.getAsFile();
        if (file) {
          processBlob(file);
          return true;
        }
      }
    }

    // 3) text/uri-list (браузер отдаёт прямую ссылку)
    const uriList = dt.getData("text/uri-list");
    const urlFromList = uriList ? extractUrlFromUriList(uriList) : null;
    if (urlFromList) {
      try {
        const blob = await tryFetchAsBlob(urlFromList);
        processBlob(blob);
        return true;
      } catch {
        try {
          const blob = await tryFetchViaTauri(urlFromList);
          processBlob(blob);
          return true;
        } catch (e) {
          console.error(e);
          setError("Failed to fetch dropped image (CORS/hotlink).");
        }
      }
    }

    // 4) text/html — вытаскиваем <img src="...">
    const html = dt.getData("text/html");
    if (html) {
      const src = extractImgSrcFromHtml(html);
      if (src) {
        try {
          const blob = await tryFetchAsBlob(src);
          processBlob(blob);
          return true;
        } catch {
          try {
            const blob = await tryFetchViaTauri(src);
            processBlob(blob);
            return true;
          } catch (e) {
            console.error(e);
            setError("Failed to fetch dropped image (CORS/hotlink).");
          }
        }
      }
    }

    return false;
  };

  useEffect(() => {
    // Вставка из буфера обмена (Ctrl+V)
    const handleGlobalPaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.includes("image")) {
          const blob = item.getAsFile();
          if (blob) {
            processBlob(blob);
            break;
          }
        }
      }
    };

    // Предотвращаем дефолтные действия браузера
    const preventDefaults = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener("paste", handleGlobalPaste);
    ["dragenter", "dragover", "dragleave", "drop"].forEach((ev) =>
      window.addEventListener(ev, preventDefaults, false)
    );

    return () => {
      window.removeEventListener("paste", handleGlobalPaste);
      ["dragenter", "dragover", "dragleave", "drop"].forEach((ev) =>
        window.removeEventListener(ev, preventDefaults)
      );
    };
  }, [onImageUpload]);

  // Локальная подсветка карточки
  const handleLocalDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };
  const handleLocalLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };
  const handleLocalDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (!e.dataTransfer) return;
    try {
      const ok = await handleDataTransfer(e.dataTransfer);
      if (!ok) setError("Unsupported drop payload.");
    } catch (err) {
      console.error(err);
      setError("Drop failed. See console.");
    }
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
        onDragEnter={handleLocalDrag}
        onDragOver={handleLocalDrag}
        onDragLeave={handleLocalLeave}
        onDrop={handleLocalDrop}
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
        <p class="mt-2">Drag & drop image here</p>
        <p
          class="mt-2"
          style={{
            fontSize: "var(--font-size-sm)",
            color: "var(--text-secondary)",
          }}
        >
          Or click to upload / paste from clipboard
        </p>
        {error && <p class="text-danger">{error}</p>}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => processBlob((e.target as HTMLInputElement).files?.[0])}
        accept="image/*"
        class="hidden"
      />
    </div>
  );
};

export default ImageUploader;
