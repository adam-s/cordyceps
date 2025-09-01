/** @file Simple image comparison utilities for Chrome extension screenshots. */

export interface ImageComparatorOptions {
  threshold?: number;
  maxDiffPixels?: number;
  maxDiffPixelRatio?: number;
}

export interface ComparatorResult {
  diff?: Buffer;
  errorMessage: string;
}

export type Comparator = (
  actualBuffer: Buffer | string,
  expectedBuffer: Buffer,
  options?: ImageComparatorOptions,
) => ComparatorResult | null;

/**
 * Get a comparator function for the given MIME type.
 * Chrome extension version with simplified functionality.
 */
export function getComparator(mimeType: string): Comparator {
  if (mimeType === 'image/png') {
    return compareImages;
  }
  if (mimeType === 'image/jpeg') {
    return compareImages;
  }
  return compareBuffers;
}

/**
 * Simple buffer comparison for non-image types.
 */
function compareBuffers(
  actualBuffer: Buffer | string,
  expectedBuffer: Buffer,
): ComparatorResult | null {
  if (typeof actualBuffer === 'string') {
    return { errorMessage: 'String comparison not implemented for screenshots' };
  }

  if (!actualBuffer || !(actualBuffer instanceof Buffer)) {
    return { errorMessage: 'Actual result should be a Buffer.' };
  }

  if (actualBuffer.length !== expectedBuffer.length) {
    return { errorMessage: 'Buffer sizes differ' };
  }

  // Simple byte-by-byte comparison
  for (let i = 0; i < actualBuffer.length; i++) {
    if (actualBuffer[i] !== expectedBuffer[i]) {
      return { errorMessage: 'Buffers differ' };
    }
  }

  return null;
}

/**
 * Simplified image comparison for Chrome extension.
 * This is a basic implementation without pixel-level analysis.
 */
function compareImages(
  actualBuffer: Buffer | string,
  expectedBuffer: Buffer,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _options: ImageComparatorOptions = {},
): ComparatorResult | null {
  if (!actualBuffer || !(actualBuffer instanceof Buffer)) {
    return { errorMessage: 'Actual result should be a Buffer.' };
  }

  // For now, just do a simple buffer comparison
  // TODO: Implement proper image comparison using Canvas API or similar
  const bufferResult = compareBuffers(actualBuffer, expectedBuffer);

  if (bufferResult) {
    return {
      errorMessage: `Images differ (simplified comparison): ${bufferResult.errorMessage}`,
    };
  }

  return null;
}

/**
 * Validate that a buffer contains a valid image of the expected type.
 */
export function validateImageBuffer(buffer: Buffer, mimeType: string): void {
  if (mimeType === 'image/png') {
    const pngMagicNumber = [137, 80, 78, 71, 13, 10, 26, 10];
    if (
      buffer.length < pngMagicNumber.length ||
      !pngMagicNumber.every((byte, index) => buffer[index] === byte)
    ) {
      throw new Error('Could not decode image as PNG.');
    }
  } else if (mimeType === 'image/jpeg') {
    const jpegMagicNumber = [255, 216];
    if (
      buffer.length < jpegMagicNumber.length ||
      !jpegMagicNumber.every((byte, index) => buffer[index] === byte)
    ) {
      throw new Error('Could not decode image as JPEG.');
    }
  }
}
