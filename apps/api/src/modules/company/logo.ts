import { imageSize } from 'image-size';
import { PNG } from 'pngjs';
import { decode } from 'jpeg-js';
/** Decode bounded raster data during settings validation; never fetch remote URLs. */
export function validInlineLogo(value: string): boolean {
  if (!value.startsWith('data:')) return true;
  if (value.length > 200000 || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value))
    return false;
  try {
    const buffer = Buffer.from(value.split(',')[1]!, 'base64'),
      image = imageSize(buffer);
    if (
      !image.width ||
      !image.height ||
      image.width > 2048 ||
      image.height > 2048 ||
      !['png', 'jpg'].includes(image.type ?? '')
    )
      return false;
    if (image.type === 'png') PNG.sync.read(buffer, { checkCRC: true });
    else decode(buffer, { maxResolutionInMP: 4, maxMemoryUsageInMB: 64 });
    return true;
  } catch {
    return false;
  }
}
