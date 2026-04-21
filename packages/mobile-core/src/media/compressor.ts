import type { MediaDimensions } from "@naro/domain";

import type { MediaFileSource } from "../media";

/**
 * Compressor adapter — useMediaUpload hook'u bu sözleşmeyi bekler.
 * Uygulama tarafında expo-image-manipulator (veya benzeri) bu adapter
 * factory'sine verilir; mobile-core platform-agnostic kalır.
 */
export type MediaCompressorAdapter = {
  compressImage: (
    source: MediaFileSource,
    constraints: { maxDimensionPx: number; mimeType?: string },
  ) => Promise<MediaFileSource & { dimensions?: MediaDimensions }>;
};

/**
 * No-op compressor — compression bypass etmek için (native modül olmayan web
 * veya test ortamlarında). Source'u değiştirmeden geri döner.
 */
export const noopCompressor: MediaCompressorAdapter = {
  async compressImage(source) {
    return source;
  },
};

/**
 * Expo Image Manipulator üzerine kurulu compressor factory'si.
 * Uygulama tarafında:
 *
 *   import * as ImageManipulator from "expo-image-manipulator";
 *   const compressor = createExpoImageCompressor({ ImageManipulator });
 *
 * şeklinde çağrılır. ImageManipulator modülü kurulu değilse no-op döner.
 */
export function createExpoImageCompressor(deps: {
  ImageManipulator?: {
    manipulateAsync: (
      uri: string,
      actions: unknown[],
      options?: { compress?: number; format?: string; base64?: boolean },
    ) => Promise<{
      uri: string;
      width: number;
      height: number;
    }>;
    SaveFormat?: { JPEG: string; PNG: string; WEBP: string };
  };
}): MediaCompressorAdapter {
  const manipulator = deps.ImageManipulator;
  if (!manipulator) {
    return noopCompressor;
  }

  return {
    async compressImage(source, constraints) {
      const resizeAction = { resize: { width: constraints.maxDimensionPx } };
      const format =
        (constraints.mimeType ?? "image/jpeg").includes("png")
          ? manipulator.SaveFormat?.PNG ?? "png"
          : manipulator.SaveFormat?.JPEG ?? "jpeg";

      const result = await manipulator.manipulateAsync(source.uri, [resizeAction], {
        compress: 0.85,
        format,
      });

      // Yeni dosya boyutunu bulmak için fetch ile okumaya gerek yok (platform
      // bağımlı); çağıran taraf istiyorsa kendisi hesaplar. Burada sadece
      // yeni uri + dimensions döneriz; sizeBytes hesaplaması çağırana bırakılır.
      return {
        ...source,
        uri: result.uri,
        dimensions: {
          width: result.width,
          height: result.height,
        },
      };
    },
  };
}
