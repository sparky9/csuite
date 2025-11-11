export interface CaptureResult {
  url: string;
  html: string;
  text: string;
  title?: string;
  metadata: {
    loadTimeMs: number;
    status: number;
    contentLength: number;
    [key: string]: unknown;
  };
}
