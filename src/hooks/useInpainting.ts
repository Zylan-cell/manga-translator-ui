import { useState, useCallback } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { DetectedTextItem } from "../types";

interface UseInpaintingArgs {
  imageSrc: string | null;
  apiBaseUrl: string;
  selectedBubbleId: number | null;
  detectedItems: DetectedTextItem[] | null;
  onImageUpdate?: (newImageSrc: string) => void;
  onProgress?: (progress: { active: boolean; label: string }) => void;
}

export function useInpainting({
  imageSrc,
  apiBaseUrl,
  selectedBubbleId,
  detectedItems,
  onImageUpdate,
  onProgress,
}: UseInpaintingArgs) {
  const [isInpainting, setIsInpainting] = useState(false);

  // Auto inpaint selected bubble using detected text areas
  const inpaintAuto = useCallback(async () => {
    if (!imageSrc || !selectedBubbleId || !detectedItems) {
      console.warn("Missing required data for auto inpainting");
      return;
    }

    const selectedItem = detectedItems.find(
      (item) => item.id === selectedBubbleId
    );
    if (!selectedItem) {
      console.warn("Selected bubble not found");
      return;
    }

    try {
      setIsInpainting(true);
      onProgress?.({ active: true, label: "Inpainting selected bubble..." });

      const base64Image = imageSrc.replace(/^data:image\/[^;]+;base64,/, "");
      const boxes = [
        [
          selectedItem.box.x1,
          selectedItem.box.y1,
          selectedItem.box.x2,
          selectedItem.box.y2,
        ],
      ];

      const response = await invoke<{ image_data: string }>(
        "inpaint_text_auto",
        {
          apiUrl: apiBaseUrl,
          imageData: base64Image,
          boxes,
          dilate: 2,
        }
      );

      if (response.image_data) {
        const newImageSrc = `data:image/png;base64,${response.image_data}`;
        onImageUpdate?.(newImageSrc);
      }
    } catch (error) {
      console.error("Auto inpainting failed:", error);
      alert(`Inpainting failed: ${error}`);
    } finally {
      setIsInpainting(false);
      onProgress?.({ active: false, label: "" });
    }
  }, [
    imageSrc,
    selectedBubbleId,
    detectedItems,
    apiBaseUrl,
    onImageUpdate,
    onProgress,
  ]);

  // Manual inpaint using custom mask
  const inpaintManual = useCallback(
    async (maskDataUrl: string, model: string = "lama_large_512px") => {
      if (!imageSrc) {
        console.warn("No image available for manual inpainting");
        return;
      }

      setIsInpainting(true);
      onProgress?.({ active: true, label: "Inpainting with manual mask..." });

      // helpers
      const loadImageFromDataUrl = (dataUrl: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = dataUrl;
        });

      const dataUrlToCanvas = async (dataUrl: string) => {
        const img = await loadImageFromDataUrl(dataUrl);
        const c = document.createElement("canvas");
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        return c;
      };

      const cropCanvas = (
        src: HTMLCanvasElement,
        rect: { x1: number; y1: number; x2: number; y2: number }
      ) => {
        const w = Math.max(1, rect.x2 - rect.x1);
        const h = Math.max(1, rect.y2 - rect.y1);
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(src, rect.x1, rect.y1, w, h, 0, 0, w, h);
        return c;
      };

      // найти bbox белых мазков на маске (маска: чёрный фон + белые мазки)
      const getMaskBBox = (mask: HTMLCanvasElement) => {
        const { width, height } = mask;
        const ctx = mask.getContext("2d");
        if (!ctx) return null;
        const d = ctx.getImageData(0, 0, width, height).data;
        let minX = width,
          minY = height,
          maxX = -1,
          maxY = -1;
        for (let y = 0; y < height; y++) {
          const row = y * width * 4;
          for (let x = 0; x < width; x++) {
            const i = row + x * 4;
            const r = d[i],
              g = d[i + 1],
              b = d[i + 2];
            // белый пиксель (порог можно подстроить)
            if (r > 200 || g > 200 || b > 200) {
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX < 0 || maxY < 0) return null;
        return { x1: minX, y1: minY, x2: maxX + 1, y2: maxY + 1 };
      };

      try {
        // 1) Грузим оригинал и маску как canvas
        const [imgCanvas, maskFullCanvas] = await Promise.all([
          dataUrlToCanvas(imageSrc),
          dataUrlToCanvas(maskDataUrl),
        ]);

        // 2) Ищем bbox мазков
        const bbox = getMaskBBox(maskFullCanvas);
        if (!bbox) {
          alert("No mask strokes detected.");
          return;
        }

        // 3) Добавим паддинг контекста
        const PAD = 16;
        const rect = {
          x1: Math.max(0, bbox.x1 - PAD),
          y1: Math.max(0, bbox.y1 - PAD),
          x2: Math.min(imgCanvas.width, bbox.x2 + PAD),
          y2: Math.min(imgCanvas.height, bbox.y2 + PAD),
        };

        // 4) Кропим оригинал и маску
        const imgCrop = cropCanvas(imgCanvas, rect);
        const maskCrop = cropCanvas(maskFullCanvas, rect);

        // 5) Нормализуем кроп маски до Ч/Б (чёрный фон, белые мазки)
        const normMask = document.createElement("canvas");
        normMask.width = maskCrop.width;
        normMask.height = maskCrop.height;
        {
          const nctx = normMask.getContext("2d")!;
          nctx.drawImage(maskCrop, 0, 0);
          const id = nctx.getImageData(0, 0, normMask.width, normMask.height);
          const p = id.data;
          for (let i = 0; i < p.length; i += 4) {
            const r = p[i],
              g = p[i + 1],
              b = p[i + 2];
            const isWhite = r > 200 || g > 200 || b > 200;
            const v = isWhite ? 255 : 0;
            p[i] = p[i + 1] = p[i + 2] = v; // ч/б
            p[i + 3] = 255; // непрозрачно
          }
          nctx.putImageData(id, 0, 0);
        }

        // 6) Готовим base64 для API
        const base64Image = imgCrop
          .toDataURL("image/png")
          .replace(/^data:image\/[^;]+;base64,/, "");
        const base64Mask = normMask
          .toDataURL("image/png")
          .replace(/^data:image\/[^;]+;base64,/, "");

        // 7) Отправляем ТОЛЬКО кропы на LaMa
        const response = await invoke<{ image_data: string }>("inpaint_lama", {
          apiUrl: apiBaseUrl,
          imageData: base64Image,
          maskData: base64Mask,
          model,
        });

        if (!response?.image_data) {
          throw new Error("Empty inpaint response");
        }

        // 8) Результат инпейнта кропа в canvas
        const resultImg = await loadImageFromDataUrl(
          `data:image/png;base64,${response.image_data}`
        );
        const resC = document.createElement("canvas");
        resC.width = resultImg.naturalWidth || resultImg.width;
        resC.height = resultImg.naturalHeight || resultImg.height;
        resC.getContext("2d")!.drawImage(resultImg, 0, 0);

        // 9) Строим альфа-маску по normMask (белое -> A=255, чёрное -> A=0)
        const maskAlpha = document.createElement("canvas");
        maskAlpha.width = normMask.width;
        maskAlpha.height = normMask.height;
        {
          const sctx = normMask.getContext("2d")!;
          const src = sctx.getImageData(0, 0, normMask.width, normMask.height);
          const dctx = maskAlpha.getContext("2d")!;
          const dst = dctx.createImageData(maskAlpha.width, maskAlpha.height);
          const sp = src.data;
          const dp = dst.data;
          for (let i = 0; i < sp.length; i += 4) {
            const v = sp[i]; // 0 или 255
            dp[i] = 0;
            dp[i + 1] = 0;
            dp[i + 2] = 0;
            dp[i + 3] = v; // альфа
          }
          dctx.putImageData(dst, 0, 0);
        }

        // 10) Маскируем результат кропа по альфе маски
        const maskedCrop = document.createElement("canvas");
        maskedCrop.width = resC.width;
        maskedCrop.height = resC.height;
        {
          const mctx = maskedCrop.getContext("2d")!;
          // кладём результат
          mctx.drawImage(resC, 0, 0);
          // оставляем только область маски
          mctx.globalCompositeOperation = "destination-in";
          mctx.drawImage(maskAlpha, 0, 0);
          mctx.globalCompositeOperation = "source-over";
        }

        // 11) Смешиваем с оригиналом ТОЛЬКО по маске
        const out = document.createElement("canvas");
        out.width = imgCanvas.width;
        out.height = imgCanvas.height;
        const octx = out.getContext("2d")!;
        octx.drawImage(imgCanvas, 0, 0); // оригинал
        octx.drawImage(maskedCrop, rect.x1, rect.y1); // подмешали инпейнт только по маске

        const newImageSrc = out.toDataURL("image/png");
        onImageUpdate?.(newImageSrc);
      } catch (error) {
        console.error("Manual inpainting (crop) failed:", error);
        alert(`Inpainting failed: ${error}`);
      } finally {
        setIsInpainting(false);
        onProgress?.({ active: false, label: "" });
      }
    },
    [imageSrc, apiBaseUrl, onImageUpdate, onProgress]
  );

  // This is the correct function to call for manual mask inpainting
  const inpaintManualMask = useCallback(
    async (maskDataUrl: string, model: string = "lama_large_512px") => {
      if (!imageSrc) {
        console.warn("No image available for manual mask inpainting");
        return;
      }

      try {
        setIsInpainting(true);
        onProgress?.({
          active: true,
          label: "Processing manual mask inpainting...",
        });

        const base64Image = imageSrc.replace(/^data:image\/[^;]+;base64,/, "");
        const base64Mask = maskDataUrl.replace(
          /^data:image\/[^;]+;base64,/,
          ""
        );

        const response = await invoke<{ image_data: string }>(
          "inpaint_manual_mask",
          {
            apiUrl: apiBaseUrl,
            imageData: base64Image,
            maskData: base64Mask,
            model,
          }
        );

        if (response.image_data) {
          const newImageSrc = `data:image/png;base64,${response.image_data}`;
          onImageUpdate?.(newImageSrc);
        }
      } catch (error) {
        console.error("Manual mask inpainting failed:", error);
        alert(`Inpainting failed: ${error}`);
      } finally {
        setIsInpainting(false);
        onProgress?.({ active: false, label: "" });
      }
    },
    [imageSrc, apiBaseUrl, onImageUpdate, onProgress]
  );

  return {
    isInpainting,
    inpaintAuto,
    inpaintManual, // You can keep this if you have another use for it
    inpaintManualMask,
  };
}
