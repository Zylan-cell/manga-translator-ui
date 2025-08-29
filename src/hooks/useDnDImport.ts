// src/hooks/useDnDImport.ts
import { useEffect, useRef, useState } from "preact/hooks";

export function useDnDImport(onImageLoaded: (dataUrl: string) => void) {
  const [isHtmlDragOver, setIsHtmlDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    const shouldHandle = (dt: DataTransfer | null) =>
      !!dt && Array.from(dt.types || []).includes("Files");

    const processBlob = (b?: Blob) => {
      if (!b) return;
      const r = new FileReader();
      r.onload = (ev) => {
        const res = ev.target?.result as string;
        if (res) onImageLoaded(res);
      };
      r.readAsDataURL(b);
    };

    const onDragEnter = (e: DragEvent) => {
      if (!shouldHandle(e.dataTransfer)) return;
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current += 1;
      setIsHtmlDragOver(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (!shouldHandle(e.dataTransfer)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const onDragLeave = (e: DragEvent) => {
      if (!shouldHandle(e.dataTransfer)) return;
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) setIsHtmlDragOver(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!shouldHandle(e.dataTransfer)) return;
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsHtmlDragOver(false);
      const dt = e.dataTransfer!;
      if (dt.files?.length) {
        const f =
          Array.from(dt.files).find((f) => f.type.startsWith("image/")) ||
          dt.files[0];
        processBlob(f);
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of Array.from(items)) {
        if (it.type.includes("image")) {
          const file = it.getAsFile();
          if (file) processBlob(file);
        }
      }
    };

    document.addEventListener("dragenter", onDragEnter, true);
    document.addEventListener("dragover", onDragOver, true);
    document.addEventListener("dragleave", onDragLeave, true);
    document.addEventListener("drop", onDrop, true);
    window.addEventListener("paste", onPaste);

    return () => {
      document.removeEventListener("dragenter", onDragEnter, true);
      document.removeEventListener("dragover", onDragOver, true);
      document.removeEventListener("dragleave", onDragLeave, true);
      document.removeEventListener("drop", onDrop, true);
      window.removeEventListener("paste", onPaste);
    };
  }, [onImageLoaded]);

  return { isHtmlDragOver };
}
