// Shared set-up for the developer tools: where Playwright comes from and where result files go. Playwright is a
// test-only dependency installed outside the game: set PLAYWRIGHT_MODULE to its index.mjs, or have it on Node's normal
// module path (NODE_PATH or a node_modules folder above the repo). Results are written to the system temp folder, not
// the repo, so running a check never dirties the working tree; set RESULTS_DIR to collect them elsewhere.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Where *-results.json and failure reports are written: RESULTS_DIR, else <tmp>/build-crew-results. */
export const RESULTS_DIR = process.env.RESULTS_DIR || path.join(os.tmpdir(), 'build-crew-results');

/** The path for result file `name` inside RESULTS_DIR, creating the folder if needed. */
export function resultsPath(name) {
  mkdirSync(RESULTS_DIR, { recursive: true });
  return path.join(RESULTS_DIR, name);
}

/** The Playwright module: PLAYWRIGHT_MODULE when set, otherwise require('playwright'). */
export async function loadPlaywright() {
  if (process.env.PLAYWRIGHT_MODULE) return import(process.env.PLAYWRIGHT_MODULE);
  return createRequire(import.meta.url)('playwright');
}

/** Chromium flags for real WebGL through SwiftShader on machines without a GPU. */
export const SWIFTSHADER_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--no-sandbox',
];
