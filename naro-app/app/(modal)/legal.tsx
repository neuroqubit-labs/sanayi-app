import {
  LEGAL_DOCUMENT_BODIES,
  LEGAL_DOCUMENT_TITLES,
  LEGAL_DOCUMENT_VERSIONS,
  type LegalDocumentKind,
} from "@naro/domain";
import { Button, Screen, Text } from "@naro/ui";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, View } from "react-native";

function isLegalKind(value: string | undefined): value is LegalDocumentKind {
  return value === "kvkk" || value === "terms";
}

export default function LegalDocumentScreen() {
  const router = useRouter();
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const kind: LegalDocumentKind = isLegalKind(doc) ? doc : "kvkk";

  const title = LEGAL_DOCUMENT_TITLES[kind];
  const body = LEGAL_DOCUMENT_BODIES[kind];
  const version = LEGAL_DOCUMENT_VERSIONS[kind];

  return (
    <Screen>
      <Stack.Screen options={{ title, headerShown: true }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="gap-3 px-4 py-4">
          <Text variant="h2">{title}</Text>
          <Text tone="muted" variant="caption">
            Versiyon: {version}
          </Text>
          <Text className="text-app-text leading-[22px]">{body}</Text>
        </View>
      </ScrollView>
      <View className="px-4 pb-4">
        <Button label="Kapat" variant="outline" fullWidth onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
