export type StorefrontDeviceMode = "mobile" | "desktop";

export const STOREFRONT_DESKTOP_MIN_WIDTH = 1024;

/**
 * Presentation boundary only. Business state, catalog, cart, search and
 * Supabase data remain shared between both storefront experiences.
 * Phones and tablets use the mobile UX; desktop-class viewports use desktop.
 */
export function getStorefrontDeviceMode(width: number): StorefrontDeviceMode {
  return width < STOREFRONT_DESKTOP_MIN_WIDTH ? "mobile" : "desktop";
}

export function getStorefrontDeviceModeFromWindow(): StorefrontDeviceMode {
  if (typeof window === "undefined") return "desktop";
  return getStorefrontDeviceMode(window.innerWidth);
}
