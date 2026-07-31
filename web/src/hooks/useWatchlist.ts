import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchUniverse,
  reorderWatchlist,
  toggleFavorite,
  toggleWatch,
} from "@/lib/stocksApi";

export function useUniverse() {
  return useQuery({
    queryKey: ["universe"],
    queryFn: fetchUniverse,
  });
}

export function useWatchlistMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["stocks"] });
  };

  const fav = useMutation({
    mutationFn: (symbol: string) => toggleFavorite(symbol),
    onSuccess: invalidate,
  });
  const watch = useMutation({
    mutationFn: (symbol: string) => toggleWatch(symbol),
    onSuccess: invalidate,
  });
  const reorder = useMutation({
    mutationFn: ({
      industry,
      symbols,
    }: {
      industry: string;
      symbols: string[];
    }) => reorderWatchlist(industry, symbols),
    onSuccess: invalidate,
  });

  return { fav, watch, reorder };
}
