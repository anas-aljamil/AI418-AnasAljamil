/**
 * Choosing a profile photo in the browser (owner request S5b, 2026-11-18): the browser's own
 * file picker (on a phone it offers the camera and the photo library), then a square from the
 * middle of the picture, scaled to 320 x 320 and saved as a JPEG, so what is sent is about
 * 30 KB whatever the camera made. The browser does all of it, so no library is needed. The
 * Expo Go app has no picker without a new dependency, so canPickPhoto is false there.
 */
import { Platform } from 'react-native';

export const PHOTO_SIZE = 320;
const QUALITY = 0.85;

export const canPickPhoto = Platform.OS === 'web' && typeof document !== 'undefined';

export interface PickedPhoto {
  content_type: 'image/jpeg';
  /** The JPEG in base64, as PUT /me/photo takes it. */
  data: string;
}

/** Opens the picker; null when the person closes it without choosing. Rejects for a file that
 * is not a picture the browser can read. */
export function pickPhoto(): Promise<PickedPhoto | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('cancel', () => resolve(null));
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const url = URL.createObjectURL(file);
      const image = new window.Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        const side = Math.min(image.naturalWidth, image.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width = PHOTO_SIZE;
        canvas.height = PHOTO_SIZE;
        const context = canvas.getContext('2d');
        if (!context || side === 0) {
          reject(new Error('unreadable image'));
          return;
        }
        const left = (image.naturalWidth - side) / 2;
        const top = (image.naturalHeight - side) / 2;
        context.drawImage(image, left, top, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
        const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
        resolve({ content_type: 'image/jpeg', data: dataUrl.slice(dataUrl.indexOf(',') + 1) });
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('unreadable image'));
      };
      image.src = url;
    });
    input.click();
  });
}
