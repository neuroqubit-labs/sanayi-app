import { Button, Text, TrustBadge } from "@naro/ui";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Send } from "lucide-react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  extractThreadSendError,
  useCaseDetailLive,
  useCaseSummaryLive,
  useCaseThreadLive,
  useMarkCaseThreadSeenLive,
  useSendCaseMessageLive,
} from "../api";
import { LiveMessageBubble } from "../components/LiveMessageBubble";
import { getCaseStatusLabel, getCaseStatusTone } from "../presentation";

const CLOSED_STATUSES = new Set(["completed", "cancelled", "archived"]);
const SEEN_DEBOUNCE_MS = 500;

export function CaseThreadScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const caseId = id ?? "";

  const summaryQuery = useCaseSummaryLive(caseId);
  const detailQuery = useCaseDetailLive(caseId);
  const threadQuery = useCaseThreadLive(caseId);
  const sendMessage = useSendCaseMessageLive(caseId);
  const markSeen = useMarkCaseThreadSeenLive(caseId);

  const [draft, setDraft] = useState("");
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const seenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Thread focus → debounce 500ms + markSeen çağır (idempotent, 204).
  useFocusEffect(
    useCallback(() => {
      if (!caseId) return;
      if (seenTimerRef.current) {
        clearTimeout(seenTimerRef.current);
      }
      seenTimerRef.current = setTimeout(() => {
        void markSeen.mutateAsync().catch(() => {
          // best-effort; 4xx durumunda sessiz düş
        });
      }, SEEN_DEBOUNCE_MS);
      return () => {
        if (seenTimerRef.current) {
          clearTimeout(seenTimerRef.current);
          seenTimerRef.current = null;
        }
      };
    }, [caseId, markSeen]),
  );

  // BE cursor: DESC; FE listeyi kronolojik gösterir → reverse.
  const messages = useMemo(() => {
    const pages = threadQuery.data?.pages ?? [];
    const flat = pages.flatMap((page) => page.items);
    return [...flat].reverse();
  }, [threadQuery.data]);

  const summary = summaryQuery.data;
  const detail = detailQuery.data;
  const status = detail?.status ?? summary?.status ?? null;
  const title = detail?.title ?? summary?.title ?? "";
  const caseClosed = status ? CLOSED_STATUSES.has(status) : false;
  const trimmed = draft.trim();
  const canSend =
    trimmed.length > 0 &&
    trimmed.length <= 2000 &&
    !sendMessage.isPending &&
    !caseClosed;

  const handleSend = async () => {
    if (!canSend) return;
    setErrorBanner(null);
    try {
      await sendMessage.mutateAsync({ content: trimmed });
      setDraft("");
    } catch (err) {
      const detail = extractThreadSendError(err);
      if (detail) {
        setErrorBanner(detail.message);
      } else {
        setErrorBanner("Mesaj gönderilemedi. Bağlantını kontrol et.");
      }
    }
  };

  const isInitialLoading =
    threadQuery.isPending && messages.length === 0 && !threadQuery.isError;

  if (!caseId || (summaryQuery.isError && !summary)) {
    return (
      <SafeAreaView className="flex-1 bg-app-bg">
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text variant="h2" tone="inverse">
            Vaka thread bulunamadı
          </Text>
          <Button
            label="Geri dön"
            variant="outline"
            onPress={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-app-bg">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-row items-center gap-3 px-6 pb-4 pt-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Geri"
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center rounded-full border border-app-outline bg-app-surface"
          >
            <ArrowLeft size={18} color="#f5f7ff" />
          </Pressable>
          <View className="flex-1 gap-1">
            <Text variant="h2" tone="inverse">
              Vaka thread
            </Text>
            <Text tone="muted" className="text-app-text-muted" numberOfLines={1}>
              {title}
            </Text>
          </View>
        </View>

        {status ? (
          <View className="mx-6 mb-4 gap-2 rounded-[24px] border border-app-outline bg-app-surface px-4 py-4">
            <TrustBadge
              label={getCaseStatusLabel(status)}
              tone={getCaseStatusTone(status)}
            />
            <Text tone="muted" className="text-app-text-muted">
              Thread vakaya bağlı ilerler; güncellemeler aynı anda timeline'a da
              düşer. Telefon/e-posta paylaşımı engellenir.
            </Text>
          </View>
        ) : null}

        {caseClosed ? (
          <View className="mx-6 mb-3 rounded-[18px] border border-app-warning/40 bg-app-warning/10 px-4 py-3">
            <Text variant="label" tone="warning" className="text-[13px]">
              Bu vaka kapandı — yeni mesaj gönderilemez.
            </Text>
          </View>
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-3 px-6 pb-6"
          keyboardShouldPersistTaps="handled"
        >
          {isInitialLoading ? (
            <View className="items-center py-6">
              <ActivityIndicator color="#83a7ff" />
            </View>
          ) : null}

          {!isInitialLoading && messages.length === 0 ? (
            <View className="mt-4 items-center gap-1 rounded-[18px] border border-dashed border-app-outline bg-app-surface px-4 py-6">
              <Text variant="label" tone="inverse">
                Henüz mesaj yok
              </Text>
              <Text variant="caption" tone="muted" className="text-app-text-muted">
                İlk mesajı sen başlat — kısa, net bir cümle yeterli.
              </Text>
            </View>
          ) : null}

          {messages.map((item) => (
            <LiveMessageBubble key={item.id} message={item} />
          ))}

          {threadQuery.hasNextPage ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Daha eski mesajları yükle"
              disabled={threadQuery.isFetchingNextPage}
              onPress={() => void threadQuery.fetchNextPage()}
              className="items-center rounded-[14px] border border-app-outline bg-app-surface py-2 active:bg-app-surface-2"
            >
              <Text variant="caption" tone="accent">
                {threadQuery.isFetchingNextPage
                  ? "Yükleniyor…"
                  : "Daha eski mesajları göster"}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>

        <View className="gap-3 border-t border-app-outline bg-app-bg px-6 pb-5 pt-4">
          {errorBanner ? (
            <View className="rounded-[14px] border border-app-critical/40 bg-app-critical/10 px-3 py-2">
              <Text variant="caption" tone="critical" className="text-[12px]">
                {errorBanner}
              </Text>
            </View>
          ) : null}
          <View className="rounded-[24px] border border-app-outline bg-app-surface px-4 py-3">
            <TextInput
              value={draft}
              onChangeText={(next) => {
                setDraft(next);
                if (errorBanner) setErrorBanner(null);
              }}
              placeholder={
                caseClosed
                  ? "Bu vaka kapandı"
                  : "Servise net ve kısa bir mesaj yaz..."
              }
              placeholderTextColor="#6f7b97"
              editable={!caseClosed}
              maxLength={2000}
              className="min-h-[92px] text-base text-app-text"
              multiline
              textAlignVertical="top"
            />
          </View>
          <Button
            label="Mesajı gönder"
            fullWidth
            loading={sendMessage.isPending}
            disabled={!canSend}
            leftIcon={<Send size={16} color="#ffffff" />}
            onPress={handleSend}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
