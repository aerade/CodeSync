import { useState, useEffect, useCallback } from "react";

export const NOTICE_KEYS = {
  noApiKeysBanner: "noApiKeysBannerDismissed",
} as const;

export type NoticeKey = (typeof NOTICE_KEYS)[keyof typeof NOTICE_KEYS];

export function resetAllNotices() {
  if (typeof localStorage === "undefined") return;
  for (const key of Object.values(NOTICE_KEYS)) {
    localStorage.removeItem(key);
  }
}

/**
 * useNotice(key) — encapsulates read/write/reset for a single notice flag.
 * Returns [dismissed, dismiss, reset]:
 *   dismissed — true when the notice has been dismissed
 *   dismiss   — marks the notice as dismissed and persists to localStorage
 *   reset     — clears the dismissed state from localStorage and state
 */
export function useNotice(key: NoticeKey): [boolean, () => void, () => void] {
  const [dismissed, setDismissed] = useState<boolean>(
    () => typeof localStorage !== "undefined" && localStorage.getItem(key) === "true"
  );

  useEffect(() => {
    function handleReset() {
      setDismissed(false);
    }
    window.addEventListener("noticesReset", handleReset);
    return () => window.removeEventListener("noticesReset", handleReset);
  }, []);

  const dismiss = useCallback(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, "true");
    }
    setDismissed(true);
  }, [key]);

  const reset = useCallback(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(key);
    }
    setDismissed(false);
  }, [key]);

  return [dismissed, dismiss, reset];
}
