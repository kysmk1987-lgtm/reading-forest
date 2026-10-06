import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { PixelRatio, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import type { CapturedImage, CaptureOptions, ShareResult } from './captureTypes';

export type { CapturedImage, CaptureOptions, ShareResult } from './captureTypes';

export async function captureView(ref: RefObject<View | null>, { width, height, targetWidth = 1080 }: CaptureOptions): Promise<CapturedImage> {
  if (!ref.current) throw new Error('capture target missing');
  const outW = targetWidth / PixelRatio.get();
  const outH = (height / width) * outW;
  const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile', width: outW, height: outH });
  return { uri, width: targetWidth, height: Math.round((height / width) * targetWidth) };
}

export async function shareImage(img: CapturedImage, _filename: string, title: string): Promise<ShareResult> {
  if (!(await Sharing.isAvailableAsync())) return saveImage(img, _filename);
  await Sharing.shareAsync(img.uri, { mimeType: 'image/png', dialogTitle: title, UTI: 'public.png' });
  return 'shared';
}

export async function saveImage(img: CapturedImage, _filename: string): Promise<ShareResult> {
  const perm = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
  if (!perm.granted) return 'denied';
  await MediaLibrary.saveToLibraryAsync(img.uri);
  return 'saved';
}

function base64ToBytes(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

async function render(uri: string, format: SaveFormat, width?: number) {
  const ctx = ImageManipulator.manipulate(uri);
  if (width) ctx.resize({ width, height: null });
  const ref = await ctx.renderAsync();
  return ref.saveAsync({ format, base64: true, compress: format === SaveFormat.JPEG ? 0.7 : 1 });
}

export async function imageBytes(img: CapturedImage): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  const jpeg = /\.jpe?g$/i.test(img.uri);
  const res = await render(img.uri, jpeg ? SaveFormat.JPEG : SaveFormat.PNG);
  return { bytes: base64ToBytes(res.base64 ?? ''), contentType: jpeg ? 'image/jpeg' : 'image/png' };
}

/** A tiny JPEG (16 px wide) — displayed upscaled with a blur, so no text is readable. */
export async function makeBlurThumb(img: CapturedImage): Promise<CapturedImage> {
  const res = await render(img.uri, SaveFormat.JPEG, 16);
  return { uri: res.uri, width: res.width, height: res.height };
}
