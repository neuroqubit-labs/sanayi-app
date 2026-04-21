import {
  BackButton,
  Button,
  PremiumListRow,
  Screen,
  Text,
  TrustBadge,
} from "@naro/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FileText } from "lucide-react-native";
import { View } from "react-native";

import { openMediaAsset } from "@/shared/media/openAsset";
import { documentStatusTone } from "@/shared/presentation/tone";

import { useCaseDetail } from "../api";

export function CaseDocumentsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: caseItem } = useCaseDetail(id ?? "");

  if (!caseItem) {
    return (
      <Screen backgroundClassName="bg-app-bg" className="flex-1 justify-center gap-4">
        <Text variant="h2" tone="inverse">
          Belge kaydı bulunamadı
        </Text>
        <Button
          label="Geri dön"
          variant="outline"
          onPress={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll backgroundClassName="bg-app-bg" className="gap-5 pb-28">
      <View className="flex-row items-center gap-3">
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 gap-1">
          <Text variant="eyebrow" tone="subtle">
            Belgeler
          </Text>
          <Text variant="h2" tone="inverse">
            {caseItem.title}
          </Text>
        </View>
      </View>

      <View className="gap-3 rounded-[28px] border border-app-outline bg-app-surface px-4 py-4">
        <Text tone="muted" className="text-app-text-muted">
          Kanıt, fatura ve servis raporu aynı bilgi hattında tutulur. Belgeler
          servis onaylandığında otomatik arşivlenir.
        </Text>
      </View>

      <View className="gap-3">
        {caseItem.documents.map((document) => (
          <PremiumListRow
            key={document.id}
            title={document.title}
            subtitle={`${document.source_label} · ${document.subtitle ?? document.status_label}`}
            onPress={() => void openMediaAsset(document.asset)}
            leading={
              <View className="h-11 w-11 items-center justify-center rounded-full border border-app-outline bg-app-surface-2">
                <FileText size={18} color="#f5f7ff" />
              </View>
            }
            badge={
              <TrustBadge
                label={document.status_label}
                tone={documentStatusTone(document.status_label)}
              />
            }
            trailing={
              <Text variant="caption" tone="subtle">
                {document.created_at_label}
              </Text>
            }
          />
        ))}
      </View>
    </Screen>
  );
}
