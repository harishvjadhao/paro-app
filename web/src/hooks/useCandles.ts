import { useQuery } from "@tanstack/react-query";
import { fetchCandles, fetchStock } from "@/lib/stocksApi";
import type { Timeframe } from "@/lib/types";

export function useStockDetail(symbol: string | null) {
  return useQuery({
    queryKey: ["stock", symbol],
    queryFn: () => fetchStock(symbol!),
    enabled: !!symbol,
  });
}

export function useCandles(
  symbol: string | null,
  timeframe: Timeframe,
  bollinger: boolean,
  rsi: boolean,
) {
  return useQuery({
    queryKey: ["candles", symbol, timeframe, bollinger, rsi],
    queryFn: () =>
      fetchCandles(symbol!, timeframe, { bars: 44, bollinger, rsi }),
    enabled: !!symbol,
  });
}
