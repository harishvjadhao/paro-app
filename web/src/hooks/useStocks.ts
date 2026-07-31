import { useQuery } from "@tanstack/react-query";
import { fetchStocks } from "@/lib/stocksApi";
import type { StockFilter } from "@/lib/types";

export function useStocks(filter: StockFilter, q: string) {
  return useQuery({
    queryKey: ["stocks", filter, q],
    queryFn: () => fetchStocks(filter, q),
    placeholderData: (prev) => prev,
  });
}
