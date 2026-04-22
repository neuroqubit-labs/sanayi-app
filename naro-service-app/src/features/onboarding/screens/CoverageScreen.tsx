import {
  BackButton,
  Button,
  Icon,
  Screen,
  StatusChip,
  Text,
  ToggleChip,
} from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import {
  Boxes,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { useUpdateCoverageMutation } from "../api/coverage";
import {
  useBrandsQuery,
  useDrivetrainsQuery,
  useProceduresQuery,
  useServiceDomainsQuery,
} from "../api/taxonomy";
import {
  validateCoverageAdmission,
  type BrandOut,
  type ProcedureOut,
} from "../coverage-schema";
import { useOnboardingStore } from "../store";

type AccordionKey = "domains" | "procedures" | "brands" | "drivetrains";

export default function CoverageScreen() {
  const router = useRouter();
  const serviceDomains = useOnboardingStore((s) => s.service_domains);
  const procedures = useOnboardingStore((s) => s.procedures);
  const brandCoverage = useOnboardingStore((s) => s.brand_coverage);
  const drivetrainCoverage = useOnboardingStore((s) => s.drivetrain_coverage);
  const toggleDomain = useOnboardingStore((s) => s.toggleServiceDomain);
  const toggleProcedure = useOnboardingStore((s) => s.toggleProcedure);
  const toggleBrand = useOnboardingStore((s) => s.toggleBrand);
  const toggleDrivetrain = useOnboardingStore((s) => s.toggleDrivetrain);

  const [openSection, setOpenSection] = useState<AccordionKey>("domains");
  const [allBrandsOptIn, setAllBrandsOptIn] = useState(false);

  const domainsQuery = useServiceDomainsQuery();
  const brandsQuery = useBrandsQuery();
  const drivetrainsQuery = useDrivetrainsQuery();
  const updateCoverage = useUpdateCoverageMutation();

  const blockingError = useMemo(
    () =>
      validateCoverageAdmission(
        {
          service_domains: serviceDomains,
          procedures: procedures.map((p) => ({
            procedure_key: p.key,
            confidence_self_declared: p.confidence_self_declared,
          })),
          brand_coverage: brandCoverage.map((b) => ({
            brand_key: b.key,
            is_authorized: b.is_authorized,
            is_premium_authorized: b.is_premium_authorized,
          })),
          drivetrain_coverage: drivetrainCoverage,
        },
        { allBrandsOptIn },
      ),
    [serviceDomains, procedures, brandCoverage, drivetrainCoverage, allBrandsOptIn],
  );

  const handleSubmit = async () => {
    if (blockingError) return;
    try {
      await updateCoverage.mutateAsync({
        service_domains: serviceDomains,
        procedures: procedures.map((p) => ({
          procedure_key: p.key,
          confidence_self_declared: p.confidence_self_declared,
        })),
        procedure_tags: [],
        brand_coverage: allBrandsOptIn
          ? []
          : brandCoverage.map((b) => ({
              brand_key: b.key,
              is_authorized: b.is_authorized,
              is_premium_authorized: b.is_premium_authorized,
              notes: b.notes ?? null,
            })),
        drivetrain_coverage: drivetrainCoverage,
      });
      router.push("/(onboarding)/review" as Href);
    } catch (err) {
      console.warn("CoverageScreen submit failed", err);
    }
  };

  const toggleSection = (key: AccordionKey) =>
    setOpenSection((prev) => (prev === key ? prev : key));

  return (
    <Screen scroll backgroundClassName="bg-app-bg" className="gap-4 pb-28">
      <View className="flex-row items-center gap-3">
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 gap-1">
          <Text variant="eyebrow" tone="subtle">
            Adım 7 / 8 · Hizmet kapsamı
          </Text>
          <Text variant="h2" tone="inverse">
            Ne yaparsın?
          </Text>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[12px]"
          >
            Havuz eşleştirmesi bu 4 boyut üstünden çalışır: alan → işlem →
            marka → motor tipi.
          </Text>
        </View>
      </View>

      <AccordionSection

        title="Uzmanlık alanları"
        icon={Layers}
        open={openSection === "domains"}
        onToggle={() => toggleSection("domains")}
        badge={`${serviceDomains.length}/12 seçili`}
        hint="En az 1 zorunlu. İşlemler buna göre açılır."
      >
        {domainsQuery.isLoading ? (
          <ActivityIndicator />
        ) : domainsQuery.isError ? (
          <InlineError
            message="Alanlar yüklenemedi. Ağı kontrol et ve tekrar dene."
            onRetry={() => domainsQuery.refetch()}
          />
        ) : (
          <View className="flex-row flex-wrap gap-2">
            {(domainsQuery.data ?? []).map((domain) => {
              const selected = serviceDomains.includes(
                domain.domain_key as (typeof serviceDomains)[number],
              );
              return (
                <ToggleChip
                  key={domain.domain_key}
                  label={domain.label}
                  selected={selected}
                  onPress={() =>
                    toggleDomain(
                      domain.domain_key as (typeof serviceDomains)[number],
                    )
                  }
                />
              );
            })}
          </View>
        )}
      </AccordionSection>

      <AccordionSection

        title="İşlemler"
        icon={Wrench}
        open={openSection === "procedures"}
        onToggle={() => toggleSection("procedures")}
        badge={`${procedures.length} seçili`}
        hint="Seçtiğin alanların altından işlemleri işaretle."
      >
        {serviceDomains.length === 0 ? (
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[12px]"
          >
            Önce bir veya daha fazla uzmanlık alanı seç.
          </Text>
        ) : (
          <View className="gap-3">
            {serviceDomains.map((domainKey) => (
              <ProcedureDomainBlock
                key={domainKey}
                domainKey={domainKey}
                selectedKeys={procedures.map((p) => p.key)}
                onToggle={(procedureKey) => toggleProcedure(procedureKey)}
              />
            ))}
          </View>
        )}
      </AccordionSection>

      <AccordionSection

        title="Marka kapsamı"
        icon={Sparkles}
        open={openSection === "brands"}
        onToggle={() => toggleSection("brands")}
        badge={
          allBrandsOptIn
            ? "Tüm markalar"
            : `${brandCoverage.length} seçili`
        }
        hint="Hangi markalara hizmet veriyorsun? Tüm markalar opt-out ile atlayabilirsin."
      >
        <View className="gap-3">
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: allBrandsOptIn }}
            onPress={() => setAllBrandsOptIn((prev) => !prev)}
            className={[
              "flex-row items-center gap-3 rounded-[16px] border px-3.5 py-2.5 active:opacity-90",
              allBrandsOptIn
                ? "border-brand-500/40 bg-brand-500/10"
                : "border-app-outline bg-app-surface",
            ].join(" ")}
          >
            <View
              className={[
                "h-5 w-5 items-center justify-center rounded-[6px] border",
                allBrandsOptIn
                  ? "border-brand-500 bg-brand-500"
                  : "border-app-outline bg-app-surface",
              ].join(" ")}
            >
              {allBrandsOptIn ? (
                <Text className="text-white text-[11px]">✓</Text>
              ) : null}
            </View>
            <View className="flex-1 gap-0.5">
              <Text variant="label" tone="inverse" className="text-[13px]">
                Tüm markalara hizmet veririm
              </Text>
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-[11px]"
              >
                Seçerseniz marka listesi boş gönderilir — backend "hepsi" sayar.
              </Text>
            </View>
          </Pressable>

          {allBrandsOptIn ? null : brandsQuery.isLoading ? (
            <ActivityIndicator />
          ) : brandsQuery.isError ? (
            <InlineError
              message="Markalar yüklenemedi."
              onRetry={() => brandsQuery.refetch()}
            />
          ) : (
            <BrandChipGrid
              brands={brandsQuery.data ?? []}
              selectedKeys={brandCoverage.map((b) => b.key)}
              onToggle={(brandKey) => toggleBrand(brandKey)}
            />
          )}
        </View>
      </AccordionSection>

      <AccordionSection

        title="Motor tipi"
        icon={Boxes}
        open={openSection === "drivetrains"}
        onToggle={() => toggleSection("drivetrains")}
        badge={`${drivetrainCoverage.length} seçili`}
        hint="Varsayılan tümü — sadece bir alt küme desteklersen işaretsizini kaldır."
      >
        {drivetrainsQuery.isLoading ? (
          <ActivityIndicator />
        ) : drivetrainsQuery.isError ? (
          <InlineError
            message="Motor tipleri yüklenemedi."
            onRetry={() => drivetrainsQuery.refetch()}
          />
        ) : (
          <View className="flex-row flex-wrap gap-2">
            {(drivetrainsQuery.data ?? []).map((dt) => {
              const selected = drivetrainCoverage.includes(
                dt.drivetrain_key as (typeof drivetrainCoverage)[number],
              );
              return (
                <ToggleChip
                  key={dt.drivetrain_key}
                  label={dt.label}
                  selected={selected}
                  onPress={() =>
                    toggleDrivetrain(
                      dt.drivetrain_key as (typeof drivetrainCoverage)[number],
                    )
                  }
                />
              );
            })}
          </View>
        )}
      </AccordionSection>

      {blockingError ? (
        <View className="rounded-[14px] border border-app-warning/40 bg-app-warning-soft px-3 py-2.5">
          <Text variant="caption" tone="warning" className="text-[12px]">
            {blockingError}
          </Text>
        </View>
      ) : null}

      {updateCoverage.isError ? (
        <View className="rounded-[14px] border border-app-critical/40 bg-app-critical-soft px-3 py-2.5">
          <Text variant="caption" tone="critical" className="text-[12px]">
            Kapsam kaydedilemedi. Ağı kontrol et ve tekrar dene.
          </Text>
        </View>
      ) : null}

      <Button
        label={updateCoverage.isPending ? "Kaydediliyor…" : "Devam et"}
        size="lg"
        disabled={blockingError !== null || updateCoverage.isPending}
        variant={blockingError === null ? "primary" : "outline"}
        loading={updateCoverage.isPending}
        onPress={handleSubmit}
        fullWidth
      />
    </Screen>
  );
}

function AccordionSection({
  title,
  icon,
  open,
  onToggle,
  badge,
  hint,
  children,
}: {
  title: string;
  icon: LucideIcon;
  open: boolean;
  onToggle: () => void;
  badge?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-2 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        onPress={onToggle}
        className="flex-row items-center gap-3"
      >
        <View className="h-9 w-9 items-center justify-center rounded-full bg-app-surface-2">
          <Icon icon={icon} size={16} color="#83a7ff" />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="label" tone="inverse" className="text-[14px]">
            {title}
          </Text>
          {badge ? (
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-subtle text-[11px]"
            >
              {badge}
            </Text>
          ) : null}
        </View>
        <Icon icon={open ? ChevronUp : ChevronDown} size={18} color="#83a7ff" />
      </Pressable>
      {open ? (
        <View className="gap-3 pt-2">
          {hint ? (
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted text-[11px] leading-[16px]"
            >
              {hint}
            </Text>
          ) : null}
          {children}
        </View>
      ) : null}
    </View>
  );
}

function ProcedureDomainBlock({
  domainKey,
  selectedKeys,
  onToggle,
}: {
  domainKey: string;
  selectedKeys: string[];
  onToggle: (procedureKey: string) => void;
}) {
  const query = useProceduresQuery(domainKey);
  const data = query.data ?? [];

  if (query.isLoading) {
    return (
      <View className="flex-row items-center gap-2">
        <ActivityIndicator />
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[12px]"
        >
          {domainKey}…
        </Text>
      </View>
    );
  }

  if (query.isError) {
    return (
      <InlineError
        message={`${domainKey} işlemleri yüklenemedi.`}
        onRetry={() => query.refetch()}
      />
    );
  }

  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <Text
          variant="eyebrow"
          tone="subtle"
          className="uppercase text-[10px]"
        >
          {domainKey}
        </Text>
        <StatusChip
          label={`${
            data.filter((p) => selectedKeys.includes(p.procedure_key)).length
          }/${data.length}`}
          tone="neutral"
        />
      </View>
      <View className="flex-row flex-wrap gap-2">
        {data.map((proc: ProcedureOut) => (
          <ToggleChip
            key={proc.procedure_key}
            label={proc.label}
            selected={selectedKeys.includes(proc.procedure_key)}
            onPress={() => onToggle(proc.procedure_key)}
          />
        ))}
      </View>
    </View>
  );
}

function BrandChipGrid({
  brands,
  selectedKeys,
  onToggle,
}: {
  brands: BrandOut[];
  selectedKeys: string[];
  onToggle: (brandKey: string) => void;
}) {
  const grouped = useMemo(() => {
    const byTier: Record<string, BrandOut[]> = {};
    for (const brand of brands) {
      const tier = brand.tier ?? "mass";
      (byTier[tier] ??= []).push(brand);
    }
    return byTier;
  }, [brands]);

  const tierOrder = ["mass", "premium", "luxury", "commercial", "motorcycle"];
  const tierLabel: Record<string, string> = {
    mass: "Genel",
    premium: "Premium",
    luxury: "Lüks",
    commercial: "Ticari",
    motorcycle: "Motosiklet",
  };

  return (
    <View className="gap-3">
      {tierOrder
        .filter((tier) => (grouped[tier] ?? []).length > 0)
        .map((tier) => (
          <View key={tier} className="gap-2">
            <Text
              variant="eyebrow"
              tone="subtle"
              className="text-[10px]"
            >
              {tierLabel[tier]}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {(grouped[tier] ?? []).map((brand) => (
                <ToggleChip
                  key={brand.brand_key}
                  label={brand.label}
                  selected={selectedKeys.includes(brand.brand_key)}
                  onPress={() => onToggle(brand.brand_key)}
                />
              ))}
            </View>
          </View>
        ))}
    </View>
  );
}

function InlineError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View className="gap-2 rounded-[14px] border border-app-critical/30 bg-app-critical-soft px-3 py-2.5">
      <Text variant="caption" tone="critical" className="text-[12px]">
        {message}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tekrar dene"
        onPress={onRetry}
        className="self-start rounded-full border border-app-critical/40 bg-app-critical/10 px-3 py-1 active:opacity-80"
      >
        <Text variant="caption" tone="critical" className="text-[11px]">
          Tekrar dene
        </Text>
      </Pressable>
    </View>
  );
}
