import type {
  TechnicianCertificate,
  TechnicianCertificateKind,
} from "@naro/domain";
import { Icon, StatusChip, Text } from "@naro/ui";
import {
  BadgeCheck,
  FileCheck2,
  FileWarning,
  IdCard,
  Landmark,
  Receipt,
  ShieldCheck,
  Truck,
  Upload,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, View } from "react-native";

type CertificateKindMeta = {
  kind: TechnicianCertificateKind;
  label: string;
  description: string;
  icon: LucideIcon;
};

const CERTIFICATE_KINDS: CertificateKindMeta[] = [
  {
    kind: "identity",
    label: "Kimlik / Ehliyet",
    description: "Başvuran kişinin resmi kimliği",
    icon: IdCard,
  },
  {
    kind: "tax_registration",
    label: "Vergi Levhası",
    description: "Güncel yıla ait vergi kaydı",
    icon: Receipt,
  },
  {
    kind: "trade_registry",
    label: "Ticaret / Oda Sicili",
    description: "Oda veya sicil kaydı belgesi",
    icon: Landmark,
  },
  {
    kind: "insurance",
    label: "Mesleki Sigorta",
    description: "İş yeri veya mesleki sorumluluk sigortası",
    icon: ShieldCheck,
  },
  {
    kind: "technical",
    label: "Teknik Yeterlilik",
    description: "MYK, TSE veya marka yetki belgesi",
    icon: Wrench,
  },
  {
    kind: "vehicle_license",
    label: "Araç Ruhsatı",
    description: "Çekici / hizmet aracı ruhsatı",
    icon: Truck,
  },
];

type Props = {
  certificates: TechnicianCertificate[];
  onUpload: (kind: TechnicianCertificateKind) => void;
  onManage?: (cert: TechnicianCertificate) => void;
};

export function CertificateSection({ certificates, onUpload, onManage }: Props) {
  return (
    <View className="gap-2 px-4">
      {CERTIFICATE_KINDS.map((meta) => {
        const cert = certificates.find((c) => c.kind === meta.kind);
        return (
          <CertificateRow
            key={meta.kind}
            meta={meta}
            certificate={cert}
            onUpload={() => onUpload(meta.kind)}
            onManage={cert && onManage ? () => onManage(cert) : undefined}
          />
        );
      })}
    </View>
  );
}

type RowProps = {
  meta: CertificateKindMeta;
  certificate?: TechnicianCertificate;
  onUpload: () => void;
  onManage?: () => void;
};

function CertificateRow({ meta, certificate, onUpload, onManage }: RowProps) {
  const uploaded = !!certificate;
  const status = certificate?.status;

  const { toneClass, statusLabel, statusTone } = resolveStatus(status);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={meta.label}
      onPress={uploaded ? onManage : onUpload}
      className={`flex-row items-start gap-3 rounded-[18px] border px-4 py-3.5 active:opacity-85 ${toneClass}`}
    >
      <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-full bg-app-surface-2">
        <Icon icon={meta.icon} size={15} color="#83a7ff" />
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text variant="label" tone="inverse" className="text-[13px]">
            {meta.label}
          </Text>
          {uploaded ? (
            <StatusChip label={statusLabel} tone={statusTone} />
          ) : null}
        </View>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[11px] leading-[15px]"
        >
          {uploaded
            ? (certificate?.title ?? meta.description)
            : meta.description}
        </Text>
        {certificate?.expires_at ? (
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-subtle text-[10px]"
          >
            Geçerlilik: {formatDate(certificate.expires_at)}
          </Text>
        ) : null}
        {certificate?.status === "rejected" && certificate.reviewer_note ? (
          <View className="mt-1 flex-row items-start gap-1.5 rounded-[10px] bg-app-critical/10 px-2 py-1.5">
            <Icon icon={FileWarning} size={11} color="#ff6b6b" />
            <Text
              variant="caption"
              tone="muted"
              className="flex-1 text-[11px] text-app-critical leading-[15px]"
            >
              {certificate.reviewer_note}
            </Text>
          </View>
        ) : null}
      </View>
      <View className="h-9 w-9 items-center justify-center rounded-full bg-app-surface-2">
        <Icon
          icon={uploaded ? (status === "approved" ? BadgeCheck : FileCheck2) : Upload}
          size={14}
          color={uploaded && status === "approved" ? "#2dd28d" : "#83a7ff"}
        />
      </View>
    </Pressable>
  );
}

function resolveStatus(status?: TechnicianCertificate["status"]): {
  toneClass: string;
  statusLabel: string;
  statusTone: "success" | "warning" | "critical" | "info" | "neutral";
} {
  switch (status) {
    case "approved":
      return {
        toneClass: "border-app-success/30 bg-app-success/5",
        statusLabel: "Onaylı",
        statusTone: "success",
      };
    case "pending":
      return {
        toneClass: "border-app-warning/30 bg-app-warning-soft",
        statusLabel: "Beklemede",
        statusTone: "warning",
      };
    case "rejected":
      return {
        toneClass: "border-app-critical/30 bg-app-critical/10",
        statusLabel: "Reddedildi",
        statusTone: "critical",
      };
    case "expired":
      return {
        toneClass: "border-app-outline bg-app-surface",
        statusLabel: "Süresi Doldu",
        statusTone: "neutral",
      };
    default:
      return {
        toneClass: "border-app-outline bg-app-surface",
        statusLabel: "Yok",
        statusTone: "neutral",
      };
  }
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export { CERTIFICATE_KINDS };
export type { CertificateKindMeta };
