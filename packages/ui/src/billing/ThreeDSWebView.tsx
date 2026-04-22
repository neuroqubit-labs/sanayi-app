import { Loader2 } from "lucide-react-native";
import { forwardRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";

import { Icon } from "../Icon";
import { Text } from "../Text";

/**
 * Iyzico checkout 3DS + naro.com.tr domain whitelisti. Callback URL'leri
 * (`naro://billing/3ds-callback` veya `https://naro.com.tr/billing/*`)
 * caller tarafta `onShouldAllowRequest` false döndürerek yakalar.
 */
const ORIGIN_WHITELIST = [
  "https://*.iyzico.com",
  "https://iyzico.com",
  "https://checkout.iyzico.com",
  "https://sandbox-checkout.iyzico.com",
  "https://naro.com.tr",
  "naro://*",
];

export type ThreeDSWebViewProps = {
  /** Iyzico checkout URL. Null → loading placeholder. */
  source: string | null;
  /**
   * Caller'a navigation kararını verir. `false` → navigation engellenir
   * (callback URL yakalandı demek). Default her URL'e izin verilir.
   */
  onShouldAllowRequest: (url: string) => boolean;
  onLoadEnd?: () => void;
  onError?: (event: { code?: string | number; description?: string }) => void;
  onMessage?: (event: WebViewMessageEvent) => void;
  /** `true` → yükleme spinner'ı üstte göster. */
  loading?: boolean;
};

/**
 * Iyzico 3D Secure WebView — SAQ A scope'ta kart verisi app'e dokunmaz.
 *
 * Güvenlik:
 * - `originWhitelist` sadece iyzico + naro domain'leri
 * - `incognito`: kart bilgisi cookie/storage cache olmaz
 * - `cacheEnabled=false` + `sharedCookiesEnabled=false`: SSO sızıntı engeli
 * - `injectedJavaScript` YAZILMAZ (postMessage attack yüzeyi)
 * - `onMessage` caller opt-in (default handler yok)
 *
 * Pattern: `useThreeDSFlow` (naro-app/src/features/billing/hooks.ts)
 * state machine'i besler; bu komponent pure-UI + WebView shell.
 */
export const ThreeDSWebView = forwardRef<WebView, ThreeDSWebViewProps>(
  function ThreeDSWebView(
    { source, onShouldAllowRequest, onLoadEnd, onError, onMessage, loading = false },
    ref,
  ) {
    if (!source) {
      return <ThreeDSPlaceholder />;
    }

    const handleShouldStart = (req: ShouldStartLoadRequest): boolean => {
      return onShouldAllowRequest(req.url);
    };

    return (
      <View className="flex-1 overflow-hidden rounded-[22px] border border-app-outline bg-app-surface">
        {loading ? (
          <View
            pointerEvents="none"
            className="absolute left-0 right-0 top-0 z-10 items-center justify-center py-2"
          >
            <View className="flex-row items-center gap-2 rounded-full border border-app-outline bg-app-surface/90 px-3 py-1.5">
              <Icon icon={Loader2} size={12} color="#83a7ff" />
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-[11px]"
              >
                Banka onayı bekleniyor
              </Text>
            </View>
          </View>
        ) : null}
        <WebView
          ref={ref}
          source={{ uri: source }}
          originWhitelist={ORIGIN_WHITELIST}
          onShouldStartLoadWithRequest={handleShouldStart}
          onLoadEnd={onLoadEnd}
          onError={(event) =>
            onError?.({
              code: event.nativeEvent.code,
              description: event.nativeEvent.description,
            })
          }
          onMessage={onMessage}
          incognito
          cacheEnabled={false}
          sharedCookiesEnabled={false}
          thirdPartyCookiesEnabled={false}
          javaScriptEnabled
          domStorageEnabled
          accessibilityLabel="Ödeme güvenlik sayfası"
          style={{ flex: 1, backgroundColor: "transparent" }}
        />
      </View>
    );
  },
);

function ThreeDSPlaceholder() {
  return (
    <View className="flex-1 items-center justify-center gap-3 rounded-[22px] border border-dashed border-app-outline bg-app-surface-2">
      <ActivityIndicator size="small" color="#83a7ff" />
      <Text
        variant="caption"
        tone="muted"
        className="text-app-text-muted text-[12px]"
      >
        Ödeme sayfası hazırlanıyor…
      </Text>
    </View>
  );
}
