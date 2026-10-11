import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
for (const name of ["evidence-probe", "tool-router"]) {
  for (const args of [[], ["--light"]]) {
    const r = spawnSync(process.execPath, [join(HERE, name, "build.mjs"), ...args], { stdio: "inherit" });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }
}
