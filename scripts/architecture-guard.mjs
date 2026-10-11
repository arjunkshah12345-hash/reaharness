#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(root, "src");

/** Allowed import targets by layer (directory name under src/). */
const allowed = {
  domain: new Set(["domain"]),
  contracts: new Set(["contracts", "domain"]),
  process: new Set(["process", "domain"]),
  tools: new Set(["tools", "domain", "contracts", "process"]),
  application: new Set([
    "application",
    "domain",
    "contracts",
    "tools",
    "process",
  ]),
  composition: new Set([
    "composition",
    "domain",
    "contracts",
    "application",
    "tools",
  ]),
  providers: new Set(["providers", "domain", "contracts", "composition"]),
  agent: new Set([
    "agent",
    "application",
    "composition",
    "contracts",
    "domain",
    "providers",
  ]),
  setup: new Set(["setup", "domain"]),
  mcp: new Set([
    "mcp",
    "application",
    "composition",
    "contracts",
    "domain",
  ]),
  cli: new Set([
    "cli",
    "agent",
    "application",
    "composition",
    "contracts",
    "domain",
    "mcp",
    "providers",
    "setup",
  ]),
};

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      files.push(full);
    }
  }
  return files;
};

const layerOf = (file) => {
  const rel = path.relative(srcRoot, file);
  return rel.split(path.sep)[0];
};

const importLayer = (fromFile, specifier) => {
  if (!specifier.startsWith(".")) return null;
  const resolved = path.resolve(path.dirname(fromFile), specifier);
  if (!resolved.startsWith(srcRoot)) return null;
  return layerOf(resolved);
};

const files = await walk(srcRoot);
const violations = [];

for (const file of files) {
  const layer = layerOf(file);
  if (path.basename(file) === "index.ts" && path.dirname(file) === srcRoot) {
    continue;
  }
  const allow = allowed[layer];
  if (!allow) continue;
  const source = await readFile(file, "utf8");
  const matches = source.matchAll(/from\s+["']([^"']+)["']/g);
  for (const match of matches) {
    const targetLayer = importLayer(file, match[1]);
    if (targetLayer && !allow.has(targetLayer)) {
      violations.push(
        `${path.relative(root, file)} → ${targetLayer} (via ${match[1]})`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error("Architecture boundary violations:");
  for (const item of violations) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`Architecture OK (${files.length} files checked)`);
