// src/hooks/useImageLibrary.ts
import { useCallback, useEffect, useState } from "preact/hooks";
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

export function useImageLibrary(
  setProgress: (p: ProgressState) => void,
  suppressProgress: boolean = false
) {
  const [imageList, setImageList] = useState<ImageInfo[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  const loadImageByIndex = useCallback(
    async (index: number) => {
      const item = imageList[index];
      if (!item) return;

      // Если уже есть dataUrl — просто активируем
      if (item.dataUrl) {
        setCurrentImageIndex(index);
        setImageSrc(item.dataUrl);
        return;
      }

      if (!suppressProgress) {
        setProgress({
          active: true,
          current: 0,
          total: 1,
          label: "Loading image...",
        });
      }
      try {
        const b64 = await invoke<string>("read_file_b64", { path: item.path });
        const mime = extToMime(item.path);
        const dataUrl = `data:${mime};base64,${b64}`;

        // Обновляем список: кладём dataUrl внутрь соответствующего элемента
        setImageList((prev) => {
          const next = [...prev];
          // index может немного "уплыть", поэтому сверим по path
          const idx =
            next.findIndex((x) => x.path === item.path) !== -1
              ? next.findIndex((x) => x.path === item.path)
              : index;
          if (next[idx]) next[idx] = { ...next[idx], dataUrl };
          return next;
        });

        // Активируем
        setCurrentImageIndex(index);
        setImageSrc(dataUrl);
      } finally {
        if (!suppressProgress) {
          setProgress({ active: false, current: 0, total: 0, label: "" });
        }
      }
    },
    [imageList, setProgress, suppressProgress]
  );

  const selectImageAt = useCallback(
    (index: number) => {
      loadImageByIndex(index);
    },
    [loadImageByIndex]
  );

  const handleImportImages = useCallback(async () => {
    const picked = await invoke<ImageInfo[]>("import_images");
    if (!picked?.length) return;

    // Мерджим с текущим списком
    setImageList((prev) => {
      const map = new Map<string, ImageInfo>();
      for (const it of prev) map.set(it.path, it);
      for (const it of picked) map.set(it.path, it);
      const next = Array.from(map.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      return next;
    });

    // Всегда выбираем первое после импорта
    setCurrentImageIndex(0);
  }, []);

  const handleImportFolder = useCallback(async () => {
    const picked = await invoke<ImageInfo[]>("import_folder");
    if (!picked?.length) return;

    setImageList((prev) => {
      const map = new Map<string, ImageInfo>();
      for (const it of prev) map.set(it.path, it);
      for (const it of picked) map.set(it.path, it);
      const next = Array.from(map.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      return next;
    });

    // Всегда выбираем первое после импорта
    setCurrentImageIndex(0);
  }, []);

  // АВТО-ЗАГРУЗКА по изменению списка:
  // как только список изменился и есть валидный индекс — загрузим это изображение.
  useEffect(() => {
    if (!imageList.length) return;
    const idx = Math.min(currentImageIndex, imageList.length - 1);
    if (idx < 0) return;
    // Если уже отображаем этот же dataUrl — ок; иначе подгрузим
    const item = imageList[idx];
    if (!item) return;
    if (item.dataUrl) {
      setImageSrc(item.dataUrl);
    } else {
      // лениво загружаем файл
      loadImageByIndex(idx);
    }
  }, [imageList]); // намеренно без зависимостей loadImageByIndex/currentImageIndex тут

  return {
    imageList,
    setImageList,
    currentImageIndex,
    setCurrentImageIndex,
    imageSrc,
    setImageSrc,
    handleImportImages,
    handleImportFolder,
    loadImageByIndex,
    selectImageAt,
  };
}
