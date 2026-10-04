import fallback from "../../content/storefront-texts.json";

export type StorefrontLanguage = "es" | "en";
export type StorefrontCopy = { key: string; source_text: string; es: string; en: string };
export const storefrontCopy: StorefrontCopy[] = fallback;

declare global {
  interface Window {
    __UPDOWN_TEXTS__?: StorefrontCopy[];
    __UPDOWN_SET_LANGUAGE__?: (language: StorefrontLanguage) => void;
    __UPDOWN_LANGUAGE_LISTENER__?: EventListener;
  }
}

export function getStorefrontText(key: string, language: StorefrontLanguage): string {
  const rows = typeof window === "undefined" ? storefrontCopy : window.__UPDOWN_TEXTS__ || storefrontCopy;
  const row = rows.find((item) => item.key === key);
  return row?.[language] || row?.es || key;
}
