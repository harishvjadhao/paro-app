import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createComment,
  deleteComment,
  fetchComments,
  updateComment,
} from "@/lib/stocksApi";

export function useComments(symbol: string | null) {
  return useQuery({
    queryKey: ["comments", symbol],
    queryFn: () => fetchComments(symbol!),
    enabled: !!symbol,
  });
}

export function useCommentMutations(symbol: string | null) {
  const qc = useQueryClient();
  const invalidate = () => {
    if (symbol) void qc.invalidateQueries({ queryKey: ["comments", symbol] });
  };

  const add = useMutation({
    mutationFn: (body: string) => createComment(symbol!, body),
    onSuccess: invalidate,
  });
  const edit = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      updateComment(symbol!, id, body),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: number) => deleteComment(symbol!, id),
    onSuccess: invalidate,
  });

  return { add, edit, remove };
}
