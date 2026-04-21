import { BackButton, Button, Text, TrustBadge } from "@naro/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Send } from "lucide-react-native";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useJobDetail, useJobThread, useSendJobMessage } from "../api";
import { MessageBubble } from "../components/MessageBubble";

export function JobThreadScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: caseItem } = useJobDetail(id ?? "");
  const { data: thread } = useJobThread(id ?? "");
  const sendMessage = useSendJobMessage(id ?? "");
  const [message, setMessage] = useState("");

  if (!caseItem || !thread) {
    return (
      <SafeAreaView className="flex-1 bg-app-bg">
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text variant="h2" tone="inverse">
            Vaka mesajı bulunamadı
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
          <BackButton onPress={() => router.back()} />
          <View className="flex-1 gap-1">
            <Text variant="eyebrow" tone="subtle">
              Mesajlar
            </Text>
            <Text
              variant="h3"
              tone="inverse"
              numberOfLines={1}
              className="text-[16px]"
            >
              {caseItem.title}
            </Text>
          </View>
        </View>

        <View className="mx-6 mb-4 gap-2 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3">
          <View className="flex-row flex-wrap items-center gap-2">
            <TrustBadge label={caseItem.subtitle} tone="info" />
            <TrustBadge label={caseItem.kind} tone="neutral" />
          </View>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[12px]"
          >
            Platform güvencesi — iletişim bu thread üzerinden ilerler.
          </Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-3 px-6 pb-6"
          keyboardShouldPersistTaps="handled"
        >
          {thread.messages.length === 0 ? (
            <View className="items-center gap-2 py-10">
              <Text tone="muted" className="text-center text-app-text-muted">
                Henüz mesaj yok. İlk mesajı sen gönderebilirsin.
              </Text>
            </View>
          ) : (
            thread.messages.map((item) => (
              <MessageBubble key={item.id} message={item} />
            ))
          )}
        </ScrollView>

        <View className="gap-3 border-t border-app-outline bg-app-bg px-6 pb-5 pt-4">
          <View className="rounded-[20px] border border-app-outline bg-app-surface px-4 py-3">
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Müşteriye net ve kısa bir mesaj yaz..."
              placeholderTextColor="#6f7b97"
              className="min-h-[72px] text-base text-app-text"
              multiline
              textAlignVertical="top"
            />
          </View>
          <Button
            label="Gönder"
            fullWidth
            loading={sendMessage.isPending}
            disabled={!message.trim()}
            leftIcon={<Send size={16} color="#ffffff" />}
            onPress={async () => {
              await sendMessage.mutateAsync(message.trim());
              setMessage("");
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
