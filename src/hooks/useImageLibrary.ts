// src/hooks/useImageLibrary.ts
import { useCallback, useState } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { ImageInfo } from "../types";
import { ProgressState } from "../types/ui";

function extToMime(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "bmp":
      return "image/bmp";
    case "gif":
      return "image/gif";
    case "tif":
    case "tiff":
      return "image/tiff";
    case "avif":
      return "image/avif";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    default:
      return "application/octet-stream";
  }
}

export function useImageLibrary(setProgress: (p: ProgressState) => void) {
  const [imageList, setImageList] = useState<ImageInfo[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  const handleImportImages = useCallback(async () => {
    const picked = await invoke<ImageInfo[]>("import_images");
    if (!picked?.length) return;

    setImageList((prev) => {
      const map = new Map<string, ImageInfo>();
      for (const it of prev) map.set(it.path, it);
      for (const it of picked) map.set(it.path, it);
      const next = Array.from(map.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      if (prev.length === 0 && next.length > 0) {
        setTimeout(() => loadImageByIndex(0), 0);
      }
      return next;
    });
  }, []);

  const loadImageByIndex = useCallback(
    async (index: number) => {
      const item = imageList[index];
      if (!item) return;

      if (item.dataUrl) {
        setCurrentImageIndex(index);
        setImageSrc(item.dataUrl);
        return;
      }

      setProgress({
        active: true,
        current: 0,
        total: 1,
        label: "Loading image...",
      });
      try {
        const b64 = await invoke<string>("read_file_b64", { path: item.path });
        const mime = extToMime(item.path);
        const dataUrl = `data:${mime};base64,${b64}`;

        setImageList((prev) => {
          const next = [...prev];
          next[index] = { ...next[index], dataUrl };
          return next;
        });

        setCurrentImageIndex(index);
        setImageSrc(dataUrl);
      } finally {
        setProgress({ active: false, current: 0, total: 0, label: "" });
      }
    },
    [imageList, setProgress]
  );

  const selectImageAt = useCallback(
    (index: number) => {
      loadImageByIndex(index);
    },
    [loadImageByIndex]
  );

  return {
    imageList,
    setImageList,
    currentImageIndex,
    setCurrentImageIndex,
    imageSrc,
    setImageSrc,
    handleImportImages,
    loadImageByIndex,
    selectImageAt,
  };
}
