import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({ ...base, testMatch: 'pos-variants.spec.ts' });
