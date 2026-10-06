import { cleanOcrText } from './ocrText';

/**
 * Web OCR: tesseract.js is loaded from a CDN only when the user taps "사진에서 글자 읽기" (not part of the app bundle).
 * Korean + English language data (~2 MB) is fetched by tesseract.js on first use and cached by the browser.
 */
const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

export const OCR_SUPPORTED = true;

export type OcrStage = 'loading' | 'language' | 'recognizing';

interface TesseractWorker {
  recognize: (image: string) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<void>;
}
interface TesseractGlobal {
  createWorker: (langs: string, oem: number, options: { logger: (m: { status: string; progress: number }) => void }) => Promise<TesseractWorker>;
}

let loader: Promise<TesseractGlobal> | null = null;

function loadTesseract(): Promise<TesseractGlobal> {
  const w = window as unknown as { Tesseract?: TesseractGlobal };
  if (w.Tesseract) return Promise.resolve(w.Tesseract);
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = TESSERACT_URL;
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.onload = () => (w.Tesseract ? resolve(w.Tesseract) : reject(new Error('tesseract missing')));
      s.onerror = () => {
        loader = null;
        reject(new Error('tesseract load failed'));
      };
      document.head.appendChild(s);
    });
  }
  return loader;
}

export async function recognizeText(imageUri: string, onProgress: (progress: number, stage: OcrStage) => void): Promise<string> {
  onProgress(0, 'loading');
  const T = await loadTesseract();
  const worker = await T.createWorker('kor+eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress(0.4 + m.progress * 0.6, 'recognizing');
      else if (/language|traineddata/i.test(m.status)) onProgress(0.05 + m.progress * 0.3, 'language');
      else onProgress(0.05, 'loading');
    },
  });
  try {
    const { data } = await worker.recognize(imageUri);
    onProgress(1, 'recognizing');
    return cleanOcrText(data.text);
  } finally {
    worker.terminate().catch(() => {});
  }
}
