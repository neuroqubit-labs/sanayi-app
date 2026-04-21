import type { LatLng } from "@naro/domain";

export type TowLocationHint = {
  label: string;
  lat_lng: LatLng;
};

export const TOW_PICKUP_HINTS: TowLocationHint[] = [
  {
    label: "TEM Otoyolu, Beşiktaş yönü, Bostancı gişe sonrası",
    lat_lng: { lat: 40.9557, lng: 29.0937 },
  },
  {
    label: "Maslak Mah. Sanayi Cad. No:42/A",
    lat_lng: { lat: 41.1098, lng: 29.019 },
  },
  {
    label: "Boğaziçi Köprüsü çıkışı, Beylerbeyi yönü",
    lat_lng: { lat: 41.0421, lng: 29.0361 },
  },
];

export const TOW_DROPOFF_HINTS: TowLocationHint[] = [
  {
    label: "Güngören Sanayi, AutoPro Servis",
    lat_lng: { lat: 41.0203, lng: 28.8801 },
  },
  {
    label: "İkitelli OSB, Mega Oto Servis",
    lat_lng: { lat: 41.0864, lng: 28.7984 },
  },
  {
    label: "Kartal Sanayi Sitesi, Usta Garaj",
    lat_lng: { lat: 40.8964, lng: 29.2115 },
  },
];

export const TOW_DEFAULT_PICKUP = TOW_PICKUP_HINTS[0]!;
export const TOW_DEFAULT_DROPOFF = TOW_DROPOFF_HINTS[0]!;
