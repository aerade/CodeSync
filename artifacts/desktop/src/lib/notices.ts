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
