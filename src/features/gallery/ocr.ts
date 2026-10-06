/**
 * Native OCR is not bundled: tesseract.js needs Web Workers/WASM, and on-device text recognition
 * (Google ML Kit / Apple Vision) needs a native module → a development build (not Expo Go).
 * The card maker hides the OCR button where `OCR_SUPPORTED` is false; users type the quote instead.
 */
export const OCR_SUPPORTED = false;

export type OcrStage = 'loading' | 'language' | 'recognizing';

export async function recognizeText(_imageUri: string, _onProgress: (progress: number, stage: OcrStage) => void): Promise<string> {
  throw new Error('OCR is only available on the web version for now');
}
