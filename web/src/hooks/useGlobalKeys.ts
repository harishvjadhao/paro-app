import { useEffect } from "react";

type KeyHandlers = {
  onPalette?: () => void;
  onEscape?: () => void;
  onSlash?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  enabled?: boolean;
};

export function useGlobalKeys(handlers: KeyHandlers) {
  const {
    onPalette,
    onEscape,
    onSlash,
    onArrowUp,
    onArrowDown,
    enabled = true,
  } = handlers;

  useEffect(() => {
    if (!enabled) return;

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName || "";
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        onPalette?.();
        return;
      }
      if (e.key === "Escape") {
        onEscape?.();
        return;
      }
      if (typing) return;
      if (e.key === "/") {
        e.preventDefault();
        onSlash?.();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        onArrowDown?.();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        onArrowUp?.();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, onArrowDown, onArrowUp, onEscape, onPalette, onSlash]);
}
