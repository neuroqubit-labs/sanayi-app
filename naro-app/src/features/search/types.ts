import type { Href } from "expo-router";

import type { FeedTip } from "@/features/home/feed";
import type { CampaignOffer, NearbyService } from "@/features/home/types";
import type { TechnicianMatch } from "@/features/ustalar/types";

export type SearchCategory =
  | "all"
  | "usta"
  | "servis"
  | "bakim"
  | "kampanya"
  | "rehber";

export type SearchPrompt = {
  id: string;
  body: string;
  category: SearchCategory;
  route: Href;
};

export type SearchSuggestionChip = {
  id: string;
  label: string;
  query: string;
};

export type SearchResult =
  | { kind: "tip"; item: FeedTip }
  | { kind: "technician"; item: TechnicianMatch }
  | { kind: "service"; item: NearbyService }
  | { kind: "campaign"; item: CampaignOffer };
