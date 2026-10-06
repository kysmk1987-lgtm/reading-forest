import { toPng } from 'html-to-image';
import type { RefObject } from 'react';
import type { View } from 'react-native';

import type { CapturedImage, CaptureOptions, ShareResult } from './captureTypes';

export type { CapturedImage, CaptureOptions, ShareResult } from './captureTypes';

const fontCss = new Map<string, Promise<string>>();

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** @font-face rules for just the fonts the card uses, with the font files inlined (html-to-image would otherwise embed every app font). */
function embedFontCss(family: string): Promise<string> {
  let p = fontCss.get(family);
  if (!p) {
    p = (async () => {
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        for (const rule of Array.from(rules)) {
          if (!(rule instanceof CSSFontFaceRule)) continue;
          const name = rule.style.getPropertyValue('font-family').replace(/["']/g, '').trim();
          if (name !== family) continue;
          const url = rule.style.getPropertyValue('src').match(/url\(["']?([^"')]+)["']?\)/)?.[1];
          if (!url) continue;
          const data = await blobToDataUrl(await (await fetch(url)).blob());
          return `@font-face { font-family: "${family}"; src: url(${data}); font-display: block; }`;
        }
      }
      return '';
    })().catch(() => '');
    fontCss.set(family, p);
  }
  return p;
}

export async function captureView(ref: RefObject<View | null>, { width, height, targetWidth = 1080, fontFamilies }: CaptureOptions): Promise<CapturedImage> {
  const node = ref.current as unknown as HTMLElement | null;
  if (!node) throw new Error('capture target missing');
  await document.fonts?.ready;
  const css = (await Promise.all(fontFamilies.map(embedFontCss))).join('\n');
  const pixelRatio = targetWidth / width;
  const uri = await toPng(node, { pixelRatio, fontEmbedCSS: css, cacheBust: false, style: { borderRadius: '0px', margin: '0px' } });
  return { uri, width: Math.round(width * pixelRatio), height: Math.round(height * pixelRatio) };
}

async function toFile(img: CapturedImage, filename: string) {
  const blob = await (await fetch(img.uri)).blob();
  return new File([blob], filename, { type: blob.type || 'image/png' });
}

function download(uri: string, filename: string) {
  const a = document.createElement('a');
  a.href = uri;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Web Share API with the image file when supported (mobile browsers), otherwise downloads the PNG. */
export async function shareImage(img: CapturedImage, filename: string, title: string): Promise<ShareResult> {
  try {
    const file = await toFile(img, filename);
    if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return 'shared';
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return 'cancelled';
  }
  download(img.uri, filename);
  return 'downloaded';
}

export async function saveImage(img: CapturedImage, filename: string): Promise<ShareResult> {
  download(img.uri, filename);
  return 'downloaded';
}

export async function imageBytes(img: CapturedImage): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  const blob = await (await fetch(img.uri)).blob();
  return { bytes: await blob.arrayBuffer(), contentType: blob.type || 'image/png' };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('image load failed'));
    el.src = src;
  });
}

/** A tiny, heavily blurred JPEG of the card (safe to serve publicly: no readable text). */
export async function makeBlurThumb(img: CapturedImage): Promise<CapturedImage> {
  const el = await loadImage(img.uri);
  const tinyW = 18;
  const tinyH = Math.max(1, Math.round((el.height / el.width) * tinyW));
  const tiny = document.createElement('canvas');
  tiny.width = tinyW;
  tiny.height = tinyH;
  tiny.getContext('2d')!.drawImage(el, 0, 0, tinyW, tinyH);
  const outW = 216;
  const outH = Math.round((tinyH / tinyW) * outW);
  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.filter = 'blur(10px)';
  ctx.drawImage(tiny, -12, -12, outW + 24, outH + 24);
  return { uri: out.toDataURL('image/jpeg', 0.7), width: outW, height: outH };
}
