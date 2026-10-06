export interface CapturedImage {
  /** data: URL on web, file:// URI on native. */
  uri: string;
  width: number;
  height: number;
}

export interface CaptureOptions {
  /** Rendered (logical) size of the view. */
  width: number;
  height: number;
  /** Output width in pixels (default 1080). */
  targetWidth?: number;
  /** Font families used inside the view (embedded on web). */
  fontFamilies: string[];
}

export type ShareResult = 'shared' | 'downloaded' | 'saved' | 'cancelled' | 'denied';
