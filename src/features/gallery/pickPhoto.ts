import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

const MAX_SIDE = 1440;

export type PickPhotoResult = { uri: string } | 'cancelled' | 'denied';

/** Lets the user choose a photo for the card background, downscaled so capture/export stays light. */
export async function pickCardPhoto(): Promise<PickPhotoResult> {
  if (Platform.OS !== 'web') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return 'denied';
  }
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.9 });
  const asset = res.canceled ? null : res.assets?.[0];
  if (!asset) return 'cancelled';
  try {
    const ctx = ImageManipulator.manipulate(asset.uri);
    if (asset.width && asset.height && Math.max(asset.width, asset.height) > MAX_SIDE) {
      const scale = MAX_SIDE / Math.max(asset.width, asset.height);
      ctx.resize({ width: Math.round(asset.width * scale), height: Math.round(asset.height * scale) });
    }
    const out = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: Platform.OS === 'web' });
    return { uri: Platform.OS === 'web' && out.base64 ? `data:image/jpeg;base64,${out.base64}` : out.uri };
  } catch (err) {
    console.warn('[card photo resize]', err);
    return { uri: asset.uri };
  }
}
