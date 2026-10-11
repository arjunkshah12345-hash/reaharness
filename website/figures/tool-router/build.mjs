/**
 * Tool router — Figure
 *
 * Concept: one harness surface routes calls to bounded tools.
 * Object: rotary turret on a bench plate. Four tool posts index under a fixed
 * gate; the lit bit is the active tool. Knurled crown turns; detent clicks.
 *
 * Size: Figure (~60 parts). ~60–75 min.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "/Users/arjunkshah21/.claude/skills/anatomy/kit/iso-kit.mjs";
import { kitScript } from "/Users/arjunkshah21/.claude/skills/anatomy/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "../../assets/figures");
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 600;
const HEIGHT = 400;

const PLATE = { x: -120, y: -100, w: 240, d: 200, r: 10 };
const PLATE_H = 14;
const FOOT_H = 5;

const HUB = [0, 0];
const HUB_R = 28;
const DISC_R = 62;
const DISC_Z = 18;
const DISC_H = 8;
const CROWN_Z = DISC_Z + DISC_H;
const POST_H = 36;
const GATE_ANGLE = -Math.PI / 2; // front of disc toward viewer-ish

const TOOLS = [
  { id: "fs_list", label: "list", bit: 10 },
  { id: "fs_read", label: "read", bit: 16 },
  { id: "shell_run", label: "shell", bit: 22 },
  { id: "session_note", label: "note", bit: 12 },
];

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [HUB[0] + DISC_R + 20, HUB[1], CROWN_Z + 28],
    [HUB[0], HUB[1] - DISC_R - 24, CROWN_Z + 20],
  ],
  WIDTH,
  HEIGHT,
  { pad: 28, azimuth: 48 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

function polar(angle, r) {
  return [HUB[0] + Math.cos(angle) * r, HUB[1] + Math.sin(angle) * r];
}

function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 20))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 6), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 12);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  const strip = { x: -96, y: PLATE.y + PLATE.d - 16, w: 192, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.45 }));
  const tag = { x: PLATE.x + 12, y: PLATE.y + 10, w: 56, d: 16, r: 1.5 };
  out.push(S(k.slabOf(tag, 0, 0.8, P, 3, 0.3), { tone: "lo", crease: "none" }));
  for (const y of [4, 7.5, 11]) {
    out.push(L(k.lineOnTop([tag.x + 4, tag.y + y], [tag.x + tag.w - (y === 7.5 ? 18 : 4), tag.y + y], 0.8, P), { tone: "faint" }));
  }
  out.push(D([at([tag.x + 3, tag.y + 3, 0.8]), at([tag.x + tag.w - 3, tag.y + 3, 0.8])], { size: 0.35, tone: "lo" }));
  return out.join("");
}

function pillar() {
  const out = [];
  out.push(S(k.cylinder(HUB[0], HUB[1], 18, 0, 4, P, 48), { tone: "mid" }));
  out.push(S(k.cylinder(HUB[0], HUB[1], 12, 4, DISC_Z - 4, P, 40), { tone: "mid", crease: "none" }));
  out.push(L([8, 12].map((z) => k.sideArc(HUB[0], HUB[1], 12, z, P, 20)).join(""), { tone: "faint" }));
  out.push(D([0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((a) => {
    const [x, y] = polar(a, 14);
    return at([x, y, 4]);
  }), { size: 0.4, tone: "lo" }));
  return out.join("");
}

function gate() {
  const out = [];
  const [gx, gy] = polar(GATE_ANGLE, DISC_R + 18);
  const frame = { x: gx - 10, y: gy - 8, w: 20, d: 16, r: 2 };
  out.push(S(k.slabOf(frame, 6, 40, P, 4, 0.5), { tone: "mid" }));
  out.push(S(k.slabOf(k.insetPlan(frame, 3), 10, 28, P, 3, 0.3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(frame, 3), 38, P), { tone: "faint" }));
  out.push(D([at([frame.x + 3, frame.y + 3, 46]), at([frame.x + frame.w - 3, frame.y + frame.d - 3, 46])], { size: 0.4 }));
  const brace = { x: gx - 4, y: gy + 6, w: 8, d: 22, r: 1.5 };
  out.push(S(k.slabOf(brace, 0, 8, P, 3, 0.4), { tone: "mid" }));
  out.push(D([at([brace.x + 4, brace.y + 4, 8]), at([brace.x + 4, brace.y + brace.d - 4, 8])], { size: 0.4 }));
  return out.join("");
}

function detent() {
  const out = [];
  const [dx, dy] = polar(GATE_ANGLE + 0.55, DISC_R + 6);
  out.push(S(k.cylinder(dx, dy, 3.2, DISC_Z - 2, 6, P, 20), { tone: "mid" }));
  out.push(S(k.cylinder(dx, dy, 2.4, DISC_Z + 4, 2, P, 18), { tone: "mid" }));
  out.push(S(k.cylinder(dx, dy, 1.6, DISC_Z + 6, 8, P, 16), { tone: "hi", lit: true }));
  out.push(L(k.sideArc(dx, dy, 2.4, DISC_Z + 5, P, 14), { tone: "lo" }));
  out.push(L(k.sideArc(dx, dy, 1.6, DISC_Z + 10, P, 12), { tone: "faint" }));
  out.push(D([at([dx, dy, DISC_Z + 14])], { size: 0.4, tone: "hi" }));
  return out.join("");
}

function toolBit(angle, bitH, lit) {
  const [x, y] = polar(angle, DISC_R - 14);
  const out = [];
  out.push(S(k.cylinder(x, y, 5.5, CROWN_Z, 4, P, 24), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 3.2, CROWN_Z + 4, POST_H - 4, P, 20), { tone: lit ? "hi" : "mid", crease: "none", lit }));
  out.push(S(k.cylinder(x, y, 2.2, CROWN_Z + POST_H, bitH, P, 16), { tone: lit ? "hi" : "mid", lit }));
  out.push(S(k.cylinder(x, y, 1.2, CROWN_Z + POST_H + bitH, 3, P, 12), { tone: lit ? "hi" : "lo", lit }));
  out.push(D([at([x, y, CROWN_Z + POST_H + bitH + 3])], { size: 0.45, tone: lit ? "hi" : "lo" }));
  out.push(L(k.sideArc(x, y, 3.2, CROWN_Z + 16, P, 12), { tone: "faint" }));
  return out.join("");
}

function turretDisc(rotation = 0, activeIndex = 0) {
  const out = [];
  out.push(S(k.cylinder(HUB[0], HUB[1], DISC_R, DISC_Z, DISC_H, P, 72, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(HUB[0], HUB[1], DISC_R - 3, CROWN_Z, P, 64), { tone: "lo" }));
  out.push(L(k.ring(HUB[0], HUB[1], HUB_R, CROWN_Z, P, 40), { tone: "faint" }));
  const ticks = k.radialTicks(HUB[0], HUB[1], DISC_R - 5, 36, 4, CROWN_Z, [1.2, 2.4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  for (let i = 0; i < 4; i++) {
    const a = rotation + (i * Math.PI) / 2;
    const [nx, ny] = polar(a, DISC_R - 4);
    out.push(D([at([nx, ny, CROWN_Z])], { size: 0.55, tone: "mid" }));
    const [sx, sy] = polar(a, DISC_R - 14);
    const socket = { x: sx - 7, y: sy - 7, w: 14, d: 14, r: 3 };
    out.push(S(k.slabOf(socket, CROWN_Z, 2, P, 3, 0.3), { tone: "lo", crease: "none" }));
  }
  out.push(S(k.cylinder(HUB[0], HUB[1], HUB_R - 4, CROWN_Z, 6, P, 40), { tone: "mid" }));
  out.push(S(k.cylinder(HUB[0], HUB[1], 10, CROWN_Z + 6, 10, P, 32), { tone: "mid" }));
  out.push(L(k.knurl(HUB[0], HUB[1], 14, CROWN_Z + 14, CROWN_Z + 22, 48, P), { tone: "lo" }));
  out.push(S(k.cylinder(HUB[0], HUB[1], 14, CROWN_Z + 14, 8, P, 40), { tone: "mid" }));
  out.push(L(k.lineOnTop([HUB[0], HUB[1]], [HUB[0] + 14, HUB[1]], CROWN_Z + 22, P), { tone: "hi" }));
  out.push(D([at([HUB[0], HUB[1], CROWN_Z + 22])], { size: 0.55, tone: "hi" }));
  TOOLS.forEach((tool, i) => {
    const a = rotation + (i * Math.PI) / 2;
    out.push(`<g data-tool="${tool.id}">${toolBit(a, tool.bit, i === activeIndex)}</g>`);
  });
  return out.join("");
}

function turretAt(index) {
  const rot = GATE_ANGLE - (index * Math.PI) / 2;
  return turretDisc(rot, index);
}

const poses = TOOLS.map((_, i) => `<g data-pose="${i}" style="${i === 0 ? "" : "display:none"}">${turretAt(i)}</g>`).join("");

const svgLive = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A tool router: a rotary turret on a bench plate. Four tool posts — list, read, shell, note — index under a fixed gate. The lit bit is the active tool the harness will call.",
  body: [plate(), pillar(), gate(), `<g data-part="poses">${poses}</g>`, detent()],
});

const live = `
const TOOLS = ${JSON.stringify(TOOLS.map((t) => t.id))};
const LABELS = ${JSON.stringify(TOOLS.map((t) => t.label))};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const poses = [...svg.querySelectorAll("[data-pose]")];
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
let index = 0, target = 0, frame = 0, last = 0, clock = 0, touring = true, visible = false, idleTimer = 0;
function show(i) {
  index = ((i % TOOLS.length) + TOOLS.length) % TOOLS.length;
  poses.forEach((g, n) => { g.style.display = n === index ? "" : "none"; });
  const text = TOOLS[index] + " · active";
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(index));
  stage.setAttribute("aria-valuetext", text);
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring && !still.matches) {
    clock += dt;
    if (clock > 2.4) { clock = 0; target = (target + 1) % TOOLS.length; show(target); }
  }
  frame = visible && touring && !still.matches ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible && touring && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (i) => {
  touring = false;
  target = i;
  show(i);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 3600);
  run();
};
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) touring = false;
stage.addEventListener("click", () => steer((index + 1) % TOOLS.length));
stage.addEventListener("keydown", (event) => {
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = (index + 1) % TOOLS.length;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = (index - 1 + TOOLS.length) % TOOLS.length;
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = TOOLS.length - 1;
  if (to === null) return;
  event.preventDefault();
  steer(to);
});
show(0);
`;

const body = k.plateHtml({
  fig: "Fig 2",
  title: "Tool router",
  hint: "Click or arrow keys to index",
  readout: `${TOOLS[0].id} · active`,
  keys: [
    { mark: "lit", label: "Active bit under the gate" },
    { mark: "raised", label: "Turret: list · read · shell · note" },
  ],
  caption:
    "One surface, four tools. Index the turret and the lit bit is the call the harness will make — same tools on MCP and CLI.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Tool router: arrow keys index tools" aria-valuemin="0" aria-valuemax="3" aria-valuenow="0">${svgLive}</div>`,
});

mkdirSync(OUT, { recursive: true });
const name = theme === "light" ? "tool-router-light.html" : "tool-router.html";
const html = k.pageHtml({ title: "Tool router — reaharness", theme, body, script: kitScript() + live, width: 680 });
writeFileSync(join(OUT, name), html);
console.log("wrote", join(OUT, name));
