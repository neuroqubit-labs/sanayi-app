import { useQuery } from "@tanstack/react-query";

import { TIPS_POOL } from "@/features/home/feed";

import type { SearchCategory, SearchResult } from "./types";

function includesQuery(haystacks: (string | undefined)[], query: string) {
  const needle = query.toLowerCase().trim();
  if (!needle) return false;
  return haystacks.some((h) => (h ?? "").toLowerCase().includes(needle));
}

/**
 * Pilot V1 — search yalnızca Naro Rehber içeriği üzerinde çalışır.
 * Mock usta/servis/kampanya araması kaldırıldı; canlı sonuç gelecek
 * sürümde `/technicians/public/feed?q=` üzerinden eklenecek.
 */
export function useSearchResults(query: string, category: SearchCategory) {
  const trimmed = query.trim();
  return useQuery<SearchResult[]>({
    queryKey: ["search", "results", trimmed.toLowerCase(), category],
    enabled: trimmed.length > 0,
    queryFn: () => {
      if (!trimmed) return [];
      const results: SearchResult[] = [];

      if (
        category === "all" ||
        category === "rehber" ||
        category === "bakim"
      ) {
        for (const tip of TIPS_POOL) {
          if (
            includesQuery(
              [tip.title, tip.subtitle, tip.tag, tip.pullQuote],
              trimmed,
            )
          ) {
            results.push({ kind: "tip", item: tip });
          }
        }
      }

      return results;
    },
  });
}
