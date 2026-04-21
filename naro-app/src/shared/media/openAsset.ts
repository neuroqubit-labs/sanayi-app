import type { MediaAsset } from "@naro/domain";
import {
  ensureMediaAssetForRead,
  selectMediaAssetUrl,
  type MediaAssetReadPreference,
} from "@naro/mobile-core";
import { Alert, Linking } from "react-native";

import { mediaApi } from "@/runtime";

export async function openMediaAsset(
  asset: MediaAsset | null | undefined,
  preference: MediaAssetReadPreference = "download",
) {
  if (!asset) {
    Alert.alert("Dosya hazır değil", "Bu kayıt için açılabilir bir medya bulunamadı.");
    return null;
  }

  try {
    const resolved = await ensureMediaAssetForRead({
      mediaApi,
      asset,
      preference,
    });
    const url = selectMediaAssetUrl(resolved, preference);

    if (!url) {
      Alert.alert("Dosya hazır değil", "Medya bağlantısı henüz oluşturulmamış.");
      return resolved;
    }

    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      throw new Error("Bu bağlantı cihazda açılamıyor.");
    }

    await Linking.openURL(url);
    return resolved;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Dosya açılırken bir sorun oluştu.";
    Alert.alert("Dosya açılamadı", message);
    return null;
  }
}
