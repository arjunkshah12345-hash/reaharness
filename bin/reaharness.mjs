#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const distEntry = path.join(here, "..", "dist", "cli", "main.js");

const load = async () => {
  if (existsSync(distEntry)) {
    return import(pathToFileURL(distEntry).href);
  }
  throw new Error(`Build output missing at ${distEntry}. Run: npm run build`);
};

const { runCli } = await load();
const code = await runCli(process.argv.slice(2));
process.exitCode = code;
