import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Lote 8A: QA uses the existing loopback Supabase + Next test servers only.
// This file belongs to the candidate QA and is NOT copied into production.
export default defineConfig({
  ...base,
  testMatch: "premium-release-viewport.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 240_000,
  expect: { timeout: 15_000 },
  reporter: "list",
});
