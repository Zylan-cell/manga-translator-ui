// src/types/index.ts
export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface TextProperties {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  textDecoration: string;
  color: string;
  strokeColor: string;
  strokeWidth: number;
}

export interface DetectedTextItem {
  id: number;
  box: BoundingBox;
  ocrText: string | null;
  translation: string | null;
  // Cached intermediate translation (e.g., Japanese -> English for 2-step translation)
  cachedIntermediateText: string | null;
  // Language code of the cached intermediate text (e.g., "EN")
  cachedIntermediateLang: string | null;
  textProperties?: TextProperties;
}

export interface LoadingState {
  ocr: boolean;
  translate: boolean;
  detect: boolean;
  models: boolean;
}

export interface FloatingWindowSettings {
  showOcr: boolean;
  showTranslation: boolean;
}

export interface TextItem {
  id: number;
  x: number;
  y: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
}

export interface ImageInfo {
  name: string;
  path: string;
  dataUrl: string;
  thumbnail: string;
  // результаты обработки для страницы (детект/ocr/перевод)
  items?: DetectedTextItem[] | null;
}

// Типы для API
export type ModelList = { data: { id: string }[] };
export type PanelDetectionResult = {
  panels: [number, number, number, number][];
};
export interface DeepLXResponse {
  code: number;
  data: string;
}
export interface RecognizeBatchResponse {
  results: string[];
}
export interface YoloDetectionResult {
  boxes: BoundingBox[];
}

export interface AppSettings {
  ocrEngine: "manga";
  easyOcrLangs: string;
  deeplTargetLang: string;
}

// Project export/import types
export interface ProjectMetadata {
  version: string;
}

export interface ProjectImageData {
  name: string;
  items: Omit<DetectedTextItem, "id">[];
}

export interface ProjectSettings {
  deeplTargetLang: string;
  ocrEngine: string;
  // Language of cached intermediate translations
  cachedIntermediateLang?: string;
}

export interface ProjectData {
  metadata: ProjectMetadata;
  images: ProjectImageData[];
  settings: ProjectSettings;
}
