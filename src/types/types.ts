export interface Screenshot {
  path: string;
  pageNumber: number;
}

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CaptureOptions {
  outputDirectory: string;
  startPage: number;
  maxPages: number | null;
  captureDelay: number;
}

export interface CaptureResult {
  success: boolean;
  count?: number;
  error?: string;
  pdfPath?: string;
} 