import type { SearchPrompt, SearchSuggestionChip } from "../types";

export const SEARCH_PROMPTS: SearchPrompt[] = [
  {
    id: "prompt-ariza",
    body: "Aracımdan sürekli ses geliyor — kime güvenebilirim?",
    category: "usta",
    route: "/(modal)/ariza-bildir",
  },
  {
    id: "prompt-cekici",
    body: "Şu an yolda kaldım, hızlıca çekici çağırmam lazım.",
    category: "usta",
    route: "/(modal)/cekici-cagir",
  },
  {
    id: "prompt-bakim",
    body: "Yaz öncesi hangi bakım kontrollerini yaptırmalıyım?",
    category: "bakim",
    route: "/(modal)/bakim-talebi",
  },
  {
    id: "prompt-kampanya",
    body: "Bu ay aracıma uygun kampanyalı paket var mı?",
    category: "kampanya",
    route: "/(tabs)/",
  },
  {
    id: "prompt-kaza",
    body: "Hafif bir kazam oldu, nereden başlamalıyım?",
    category: "rehber",
    route: "/(modal)/kaza-bildir",
  },
];

export const SEARCH_VEHICLE_SUGGESTIONS: SearchSuggestionChip[] = [
  { id: "v-yag", label: "Yağ bakım zamanı", query: "yağ" },
  { id: "v-zincir", label: "Zincir kontrolü", query: "zincir" },
  { id: "v-klima", label: "Klima gaz şarjı", query: "klima" },
  { id: "v-lastik", label: "Yaz lastiği", query: "lastik" },
];

export const SEARCH_POPULAR_QUERIES: SearchSuggestionChip[] = [
  { id: "p-motor", label: "Motor bakımı", query: "motor" },
  { id: "p-bmw-servis", label: "BMW servis", query: "bmw" },
  { id: "p-fren-balata", label: "Fren balata", query: "fren" },
  { id: "p-klima", label: "Klima", query: "klima" },
  { id: "p-periyodik", label: "Periyodik bakım", query: "bakım" },
  { id: "p-lastik", label: "Lastik", query: "lastik" },
  { id: "p-yag-degisimi", label: "Yağ değişimi", query: "yağ" },
  { id: "p-elektrik", label: "Elektrik arıza", query: "elektrik" },
  { id: "p-oto-boya", label: "Oto boya", query: "boya" },
  { id: "p-kaporta", label: "Kaporta", query: "kaporta" },
];
