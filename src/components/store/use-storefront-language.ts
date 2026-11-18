"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("updown:language-change", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("updown:language-change", onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readLanguage() {
  try { return localStorage.getItem("upDownLanguage") === "en" ? "en" : "es"; }
  catch { return "es"; }
}

function serverLanguage() { return "es"; }

export function useStorefrontLanguage() {
  return useSyncExternalStore(subscribe, readLanguage, serverLanguage);
}
