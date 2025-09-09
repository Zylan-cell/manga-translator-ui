// src/components/ui/ImageList.tsx
import { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { ImageInfo } from "../../types";
import ContextMenu, { MenuItem } from "./ContextMenu";

interface ImageListProps {
  images: ImageInfo[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onRemoveAt: (index: number) => void;
  onClearAll: () => void;
}

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

const ImageList: FunctionalComponent<ImageListProps> = ({
  images,
  currentIndex,
  onSelect,
  onRemoveAt,
  onClearAll,
}) => {
  const [fallbackSrc, setFallbackSrc] = useState<Record<string, string>>({});
  const [ctx, setCtx] = useState<{
    visible: boolean;
    x: number;
    y: number;
    items: MenuItem[];
  }>({ visible: false, x: 0, y: 0, items: [] });

  const getThumbSrc = (img: ImageInfo) =>
    fallbackSrc[img.path] ||
    img.thumbnail ||
    img.dataUrl ||
    convertFileSrc(img.path);

  const handleImgError = async (img: ImageInfo) => {
    try {
      const b64 = await invoke<string>("read_file_b64", { path: img.path });
      const mime = extToMime(img.path);
      const dataUrl = `data:${mime};base64,${b64}`;
      setFallbackSrc((m) => ({ ...m, [img.path]: dataUrl }));
    } catch (e) {
      console.error("Preview fallback failed:", e);
    }
  };

  const openMenu = (e: MouseEvent, items: MenuItem[]) => {
    e.preventDefault();
    e.stopPropagation();
    setCtx({ visible: true, x: e.clientX, y: e.clientY, items });
  };
  const closeMenu = () => setCtx((p) => ({ ...p, visible: false }));

  return (
    <div
      className="image-sidebar"
      onContextMenu={(e) =>
        openMenu(e as unknown as MouseEvent, [
          { label: "Clear All Images", onClick: onClearAll },
        ])
      }
    >
      <div className="image-list">
        {images.map((img, idx) => (
          <div
            key={img.path + idx}
            className={`image-item ${idx === currentIndex ? "active" : ""}`}
            onClick={() => onSelect(idx)}
            onContextMenu={(e) =>
              openMenu(e as unknown as MouseEvent, [
                { label: "Remove This Image", onClick: () => onRemoveAt(idx) },
                { separator: true },
                { label: "Clear All Images", onClick: onClearAll },
              ])
            }
            title={img.name}
          >
            <img
              src={getThumbSrc(img)}
              alt={img.name}
              loading="lazy"
              decoding="async"
              onError={() => handleImgError(img)}
              style={{ objectFit: "contain" }}
            />
            <span>{img.name}</span>
          </div>
        ))}
      </div>

      <ContextMenu
        x={ctx.x}
        y={ctx.y}
        visible={ctx.visible}
        items={ctx.items}
        onClose={closeMenu}
      />
    </div>
  );
};

export default ImageList;
