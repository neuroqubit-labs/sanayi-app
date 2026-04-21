import { Button, Text, TrustBadge } from "@naro/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Send } from "lucide-react-native";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCaseDetail, useCaseThread, useSendCaseMessage } from "../api";
import { MessageBubble } from "../components/MessageBubble";
import { getCaseStatusLabel, getCaseStatusTone } from "../presentation";

export function CaseThreadScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: caseItem } = useCaseDetail(id ?? "");
  const { data: thread } = useCaseThread(id ?? "");
  const sendMessage = useSendCaseMessage(id ?? "");
  const [message, setMessage] = useState("");

  if (!caseItem || !thread) {
    return (
      <SafeAreaView className="flex-1 bg-app-bg">
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text variant="h2" tone="inverse">
            Vaka thread bulunamadi
          </Text>
          <Button
            label="Geri don"
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
            <Text tone="muted" className="text-app-text-muted">
              {caseItem.title}
            </Text>
          </View>
        </View>

        <View className="mx-6 mb-4 gap-2 rounded-[24px] border border-app-outline bg-app-surface px-4 py-4">
          <TrustBadge
            label={getCaseStatusLabel(caseItem.status)}
            tone={getCaseStatusTone(caseItem.status)}
          />
          <Text tone="muted" className="text-app-text-muted">
            Thread vakaya bagli ilerler; guncellemeler ayni anda timeline'a da
            duser.
          </Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-3 px-6 pb-6"
          keyboardShouldPersistTaps="handled"
        >
          {thread.messages.map((item) => (
            <MessageBubble key={item.id} message={item} />
          ))}
        </ScrollView>

        <View className="gap-3 border-t border-app-outline bg-app-bg px-6 pb-5 pt-4">
          <View className="rounded-[24px] border border-app-outline bg-app-surface px-4 py-3">
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Servise net ve kisa bir mesaj yaz..."
              placeholderTextColor="#6f7b97"
              className="min-h-[92px] text-base text-app-text"
              multiline
              textAlignVertical="top"
            />
          </View>
          <Button
            label="Mesaji gonder"
            fullWidth
            loading={sendMessage.isPending}
            disabled={!message.trim()}
            leftIcon={<Send size={16} color="#ffffff" />}
            onPress={async () => {
              await sendMessage.mutateAsync({ body: message.trim() });
              setMessage("");
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
