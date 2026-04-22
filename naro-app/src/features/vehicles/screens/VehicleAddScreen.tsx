import {
  FlowProgress,
  FlowScreen,
  Icon,
  StackedActions,
  Text,
  ToggleChip,
  TrustBadge,
} from "@naro/ui";
import { useRouter } from "expo-router";
import {
  Check,
  Gauge,
  Quote,
  ShieldCheck,
  Sparkles,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { useDraftGuard } from "@/shared/navigation/useDraftGuard";

import { useAddVehicle } from "../api";
import type { VehicleDraft } from "../types";

const INPUT_CLASS =
  "rounded-[22px] border border-app-outline bg-app-surface px-4 py-3 text-base text-app-text";

const FUEL_OPTIONS = ["Benzin", "Dizel", "LPG", "Elektrik", "Hibrit"];

const PLATE_REGEX = /^\d{2}\s?[A-ZÇĞİÖŞÜ]{1,3}\s?\d{2,4}$/;

type Step = {
  key: "basics" | "usage" | "details" | "history";
  title: string;
  description: string;
};

// NOTE: transmission + engine + chronicNotes alanları kaldırıldı
// (matching-structural-audit 2026-04-23 P0-2: backend schema'da yok, FE
// payload'a düşürülüyordu — kullanıcıya "kaydedildi" illüzyonu yaratma).
// V1.1'de BE schema extend edilirse geri gelir.
const STEPS: Step[] = [
  {
    key: "basics",
    title: "Temel",
    description: "Plaka, marka, model",
  },
  {
    key: "usage",
    title: "Kullanım",
    description: "Kilometre + yakıt",
  },
  {
    key: "details",
    title: "Detay",
    description: "Renk + not",
  },
  {
    key: "history",
    title: "Geçmiş",
    description: "Eşleşme izni",
  },
];

export function VehicleAddScreen() {
  const router = useRouter();
  const addVehicle = useAddVehicle();
  const [stepIndex, setStepIndex] = useState(0);

  const [plate, setPlate] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [fuel, setFuel] = useState<string | undefined>("Benzin");
  const [mileage, setMileage] = useState("");
  const [color, setColor] = useState("");
  const [note, setNote] = useState("");
  const [historyAccessGranted, setHistoryAccessGranted] = useState(false);

  const plateValid = PLATE_REGEX.test(plate.trim().toUpperCase());
  const hasBasics = plate.trim() && make.trim() && model.trim() && plateValid;

  const hasContent = Boolean(
    plate.trim() ||
      make.trim() ||
      model.trim() ||
      color.trim() ||
      note.trim() ||
      mileage.trim(),
  );

  useDraftGuard({
    enabled: hasContent && !addVehicle.isSuccess,
    title: "Aracı kaydet veya çık",
    message:
      "Yeni araç bilgilerini girdin. Kaydet ya da vazgeç seçeneklerinden birini seç.",
    onDiscard: () => {
      // state kendisi kaybolacak — dialog dispatch ile ekran kapanıyor
    },
  });

  const step = STEPS[stepIndex]!;

  const validationMessage = useMemo(() => {
    if (step.key === "basics") {
      if (!plate.trim()) return "Plaka zorunlu.";
      if (!plateValid) return "Plaka formatı doğru değil. Örn: 34 ABC 42.";
      if (!make.trim()) return "Marka zorunlu.";
      if (!model.trim()) return "Model zorunlu.";
    }

    if (step.key === "usage") {
      if (mileage && Number.isNaN(Number(mileage.replace(/\./g, "")))) {
        return "Kilometre değeri sayı olmalı.";
      }
    }

    return null;
  }, [step.key, plate, plateValid, make, model, mileage]);

  const isLast = stepIndex === STEPS.length - 1;

  async function handleSave() {
    const draft: VehicleDraft = {
      plate: plate.trim().toUpperCase(),
      make: make.trim(),
      model: model.trim(),
      year: year ? Number(year) : undefined,
      fuel,
      mileageKm: mileage ? Number(mileage.replace(/\./g, "")) : undefined,
      color: color.trim() || undefined,
      note: note.trim() || undefined,
      chronicNotes: [],
      historyAccessGranted,
    };

    const vehicle = await addVehicle.mutateAsync(draft);
    router.replace(`/arac/${vehicle.id}`);
  }

  const progressSteps = STEPS.map((entry) => ({
    key: entry.key,
    title: entry.title,
    description: entry.description,
  }));

  return (
    <FlowScreen
      eyebrow="Yeni araç"
      title="Araç profilini bir kez kur, hep hazır kalsın"
      description="Plakan ve aracın tanımlandığında vakalar, teklifler ve bakım hatırlatmaları doğrudan buraya bağlanır."
      onBack={() => router.back()}
      backVariant={stepIndex === 0 ? "close" : "back"}
      progress={
        <View className="gap-3">
          <TrustBadge label="Araç hafızası" tone="accent" />
          <FlowProgress
            steps={progressSteps}
            activeIndex={stepIndex}
            variant="bar"
          />
        </View>
      }
      footer={
        <StackedActions
          primaryLabel={isLast ? "Aracı kaydet" : "Devam et"}
          onPrimary={() => {
            if (validationMessage) return;

            if (!isLast) {
              setStepIndex((current) =>
                Math.min(current + 1, STEPS.length - 1),
              );
              return;
            }

            if (!hasBasics) {
              setStepIndex(0);
              return;
            }

            void handleSave();
          }}
          primaryLoading={addVehicle.isPending}
          primaryDisabled={Boolean(validationMessage) || (isLast && !hasBasics)}
          secondaryLabel={stepIndex === 0 ? "İptal" : "Geri"}
          onSecondary={() => {
            if (stepIndex === 0) {
              router.back();
              return;
            }

            setStepIndex((current) => Math.max(current - 1, 0));
          }}
          helperText={
            validationMessage
              ? validationMessage
              : isLast
                ? "Araç eklendiğinde doğrudan araç profiline gidersin."
                : "Opsiyonel adımları atlayabilirsin; daha sonra düzenleyebilirsin."
          }
          helperTone={validationMessage ? "warning" : "subtle"}
        />
      }
    >
      {step.key === "basics" ? (
        <View className="gap-4">
          <SectionCard
            title="Plaka"
            description="Doğru yazıldığında vaka geçmişin otomatik eşleşir."
          >
            <TextInput
              value={plate}
              onChangeText={setPlate}
              placeholder="Örn: 34 ABC 42"
              placeholderTextColor="#6f7b97"
              autoCapitalize="characters"
              className={INPUT_CLASS}
            />
          </SectionCard>

          <SectionCard title="Marka ve model">
            <TextInput
              value={make}
              onChangeText={setMake}
              placeholder="Marka — örn: BMW"
              placeholderTextColor="#6f7b97"
              className={INPUT_CLASS}
            />
            <TextInput
              value={model}
              onChangeText={setModel}
              placeholder="Model — örn: 3 Serisi"
              placeholderTextColor="#6f7b97"
              className={INPUT_CLASS}
            />
            <TextInput
              value={year}
              onChangeText={setYear}
              keyboardType="number-pad"
              placeholder="Yıl (opsiyonel)"
              placeholderTextColor="#6f7b97"
              className={INPUT_CLASS}
            />
          </SectionCard>

          <SectionCard title="Yakıt ve vites">
            <Text variant="label" tone="inverse">
              Yakıt
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {FUEL_OPTIONS.map((option) => (
                <ToggleChip
                  key={option}
                  label={option}
                  selected={fuel === option}
                  onPress={() => setFuel(fuel === option ? undefined : option)}
                />
              ))}
            </View>
          </SectionCard>
        </View>
      ) : null}

      {step.key === "usage" ? (
        <View className="gap-4">
          <SectionCard
            title="Güncel kilometre"
            description="Servisler bakım önerilerini bu değere göre planlıyor."
          >
            <TextInput
              value={mileage}
              onChangeText={setMileage}
              keyboardType="number-pad"
              placeholder="Örn: 87500"
              placeholderTextColor="#6f7b97"
              className={INPUT_CLASS}
            />
          </SectionCard>
        </View>
      ) : null}

      {step.key === "details" ? (
        <View className="gap-4">
          <SectionCard title="Renk + ek not (opsiyonel)">
            <TextInput
              value={color}
              onChangeText={setColor}
              placeholder="Renk — örn: Koyu Gri"
              placeholderTextColor="#6f7b97"
              className={INPUT_CLASS}
            />
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Sadece senin görebileceğin kısa bir not..."
              placeholderTextColor="#6f7b97"
              className={[INPUT_CLASS, "min-h-[96px] py-3"].join(" ")}
              multiline
              textAlignVertical="top"
            />
          </SectionCard>
        </View>
      ) : null}

      {step.key === "history" ? (
        <HistoryConsentStep
          granted={historyAccessGranted}
          plate={plate.trim()}
          onToggle={() => setHistoryAccessGranted((prev) => !prev)}
        />
      ) : null}
    </FlowScreen>
  );
}

type HistoryConsentStepProps = {
  granted: boolean;
  plate: string;
  onToggle: () => void;
};

function HistoryConsentStep({
  granted,
  plate,
  onToggle,
}: HistoryConsentStepProps) {
  return (
    <View className="gap-4">
      <View className="items-center gap-4 rounded-[28px] border border-app-outline-strong bg-app-surface-2 px-5 py-7">
        <View className="h-20 w-20 items-center justify-center rounded-[28px] border border-brand-500/30 bg-brand-500/15">
          <Icon icon={Gauge} size={36} color="#0ea5e9" />
        </View>
        <View className="items-center gap-2">
          <Text
            variant="display"
            tone="inverse"
            className="text-center text-[26px] leading-[30px]"
          >
            Naro aracını tanısın
          </Text>
          <Text tone="muted" className="text-center text-app-text-muted leading-6">
            Bakım, sigorta ve plaka geçmişine erişmemize izin ver — sana çıkan
            ustalar ve teklifler daha doğru eşleşir.
          </Text>
        </View>
      </View>

      <View className="gap-3 rounded-[24px] border border-app-outline bg-app-surface px-5 py-5">
        <View className="flex-row items-start gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-app-surface-2">
            <Icon icon={Quote} size={16} color="#83a7ff" />
          </View>
          <Text
            tone="muted"
            className="flex-1 italic text-app-text-muted leading-6"
          >
            İki yıl önce Beşiktaş'ta 3 Serisi'nin yağ değişimini yaptıran Ayşe,
            geçen ay başka bir ustaya gitti — kimse önceki raporu görmediği
            için "önce genel bakım yapalım" dendi. Aynı filtre ikinci kez
            değişti, aynı para ikinci kez gitti.
          </Text>
        </View>
        <View className="h-px bg-app-outline/60" />
        <Text variant="caption" tone="muted" className="text-app-text-subtle">
          Naro tanırsa bu tekrar etmez.
        </Text>
      </View>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: granted }}
        accessibilityLabel="Geçmişe erişim izni ver"
        onPress={onToggle}
        className={[
          "gap-3 rounded-[22px] border px-4 py-4 active:opacity-90",
          granted
            ? "border-brand-500/40 bg-brand-500/10"
            : "border-app-outline bg-app-surface",
        ].join(" ")}
      >
        <View className="flex-row items-center gap-3">
          <View
            className={[
              "h-6 w-6 items-center justify-center rounded-[8px] border",
              granted
                ? "border-brand-500 bg-brand-500"
                : "border-app-outline bg-app-surface",
            ].join(" ")}
          >
            {granted ? <Icon icon={Check} size={14} color="#ffffff" /> : null}
          </View>
          <View className="flex-1 gap-0.5">
            <Text variant="label" tone="inverse">
              Geçmişe erişim izni veriyorum
            </Text>
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted"
            >
              {plate
                ? `${plate} · TRAMER + servis kayıtları dahil`
                : "TRAMER + servis kayıtları dahil"}
            </Text>
          </View>
        </View>
      </Pressable>

      <View
        className={[
          "flex-row items-center gap-3 rounded-[20px] border px-4 py-3.5",
          granted
            ? "border-app-success/30 bg-app-success-soft"
            : "border-app-outline bg-app-surface",
        ].join(" ")}
      >
        <View
          className={[
            "h-9 w-9 items-center justify-center rounded-full",
            granted ? "bg-app-success/20" : "bg-app-surface-2",
          ].join(" ")}
        >
          <Icon
            icon={Sparkles}
            size={16}
            color={granted ? "#2dd28d" : "#83a7ff"}
          />
        </View>
        <View className="flex-1 gap-0.5">
          <Text
            variant="label"
            tone={granted ? "success" : "inverse"}
          >
            {granted ? "Eşleşme skorun +12 puan" : "Eşleşme skorun için +12 puan"}
          </Text>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted"
          >
            {granted
              ? "Naro aracını tanıdığında sana daha uyumlu ustalar ve teklifler çıkar."
              : "İzin verdiğinde aktifleşir — istediğin zaman aracın profilinden kapatabilirsin."}
          </Text>
        </View>
      </View>

      <View className="flex-row items-start gap-3 rounded-[20px] border border-app-info/30 bg-app-info-soft px-4 py-3.5">
        <View className="mt-0.5 h-7 w-7 items-center justify-center rounded-full bg-app-info/20">
          <Icon icon={ShieldCheck} size={14} color="#83a7ff" />
        </View>
        <Text
          variant="caption"
          tone="muted"
          className="flex-1 text-app-text-muted leading-5"
        >
          Veri yalnızca Naro algoritmasında kalır. Servislerle ancak sen vaka
          açtığında paylaşılır; istediğin zaman geri alabilirsin.
        </Text>
      </View>
    </View>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-3 rounded-[28px] border border-app-outline bg-app-surface px-4 py-4">
      <View className="gap-1">
        <Text variant="h3" tone="inverse">
          {title}
        </Text>
        {description ? (
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            {description}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}
