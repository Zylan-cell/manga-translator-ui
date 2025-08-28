export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence: number;
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
  textProperties?: TextProperties;
}

export interface LoadingState {
  ocr: boolean;
  translate: boolean;
  detect: boolean;
  models: boolean;
  inpaint?: boolean;
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
export interface InpaintResponse {
  image_data: string;
  mask_data?: string;
}
export interface YoloDetectionResult {
  boxes: BoundingBox[];
}

export interface AppSettings {
  ocrEngine: "manga" | "easy";
  easyOcrLangs: string;
  ocrAutoRotate: boolean;
  deeplTargetLang: string;
}
