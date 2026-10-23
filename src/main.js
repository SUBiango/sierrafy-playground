// The only Sierrafy import on this page. The `/nin` subpath is the validator
// on its own — no OCR, so no `sharp`/`tesseract.js` and nothing Node-only ends
// up in the browser bundle (docs.sierrafy.dev/nin-validation).
import { validateNin, defaultNinFormatSchema } from "@sierrafy/sdk/nin";

/* global __SDK__ */
const SDK = __SDK__;

const $ = (id) => document.getElementById(id);
const input = $("nin");
const blacklistEl = $("blacklist");
const cellsEl = $("cells");
const countEl = $("count");
const statusEl = $("status");
const checksEl = $("checks");
const jsonEl = $("json");
const callEl = $("call");
const timingEl = $("timing");

/* ---------- Package badge ---------- */
{
  const pkg = $("pkg");
  pkg.querySelector(".pkg-name").textContent = `${SDK.name}@${SDK.version}`;
  const src = pkg.querySelector(".pkg-source");
  src.textContent = SDK.source === "npm" ? "from npm" : "local build · not published";
  src.classList.add(SDK.source === "npm" ? "is-npm" : "is-local");
  $("foot-ver").textContent = `Testing ${SDK.name}@${SDK.version} (${SDK.source === "npm" ? "npm" : "local"})`;
}

/* ---------- Samples ---------- */
const SAMPLES = [
  { value: "K7M2QX4P", label: "valid sample" },
  { value: "k7m2qx4p", label: "lowercase" },
  { value: "K7M2QX", label: "too short" },
  { value: "K7M QX4P", label: "contains a space" },
  { value: "K7M2-QX4", label: "special character" },
  { value: "SL20230815K7M2QX4P0", label: "Personal ID No., not a NIN" },
  { value: "TEST0000", label: "on the blocklist" },
];

const chipsEl = $("chips");
for (const s of SAMPLES) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chip";
  b.innerHTML = `<code></code><span></span>`;
  b.querySelector("code").textContent = s.value;
  b.querySelector("span").textContent = s.label;
  b.addEventListener("click", () => {
    input.value = s.value;
    run({ flash: true });
    input.focus();
  });
  chipsEl.append(b);
}

/* ---------- Check metadata ---------- */
const CHECKS = [
  { key: "length", rule: "Exactly 8 characters" },
  { key: "charset", rule: "Uppercase A–Z and 0–9 only" },
  { key: "checksum", rule: "Not enforced until confirmed with NCRA", skipped: true },
  { key: "blacklist", rule: "Not on your blocklist" },
];

// validateNin never throws and reports non-string input as INVALID_LENGTH,
// so these four codes are the complete set.
const MESSAGES = {
  INVALID_LENGTH: (r) => `NINs are 8 characters; this one has ${r.nin.length}.`,
  INVALID_CHARSET: "Only uppercase letters and digits are allowed — no lowercase, spaces or symbols.",
  INVALID_CHECKSUM: "The check digit doesn't match.",
  BLACKLISTED: "This NIN is on the blocklist you supplied.",
};

const ICONS = {
  pass: '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  fail: '<svg viewBox="0 0 24 24"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
  skip: '<svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg>',
  idle: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="1.6" fill="currentColor"/></svg>',
};

for (const c of CHECKS) {
  const li = document.createElement("li");
  li.className = "check";
  li.dataset.key = c.key;
  li.innerHTML = `
    <span class="check-icon"></span>
    <div><p class="check-name">${c.key}</p><p class="check-rule"></p></div>
    <span class="check-state"></span>`;
  li.querySelector(".check-rule").textContent = c.rule;
  checksEl.append(li);
}

/* ---------- Helpers ---------- */
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);

function highlightJson(obj) {
  const json = JSON.stringify(obj, null, 2);
  return esc(json).replace(
    /(&quot;(?:[^&]|&(?!quot;))*?&quot;)(\s*:)?|\b(true|false)\b|(-?\d+(?:\.\d+)?)|([{}\[\],])/g,
    (m, str, colon, bool, num, punc) => {
      if (str) return colon ? `<span class="j-key">${str}</span><span class="j-punc">:</span>` : `<span class="j-str">${str}</span>`;
      if (bool) return `<span class="j-${bool}">${bool}</span>`;
      if (num) return `<span class="j-num">${num}</span>`;
      return `<span class="j-punc">${punc}</span>`;
    }
  );
}

function callSnippet(nin, blacklist) {
  const q = (s) => `<span class="c-str">'${esc(s.replace(/\\/g, "\\\\").replace(/'/g, "\\'"))}'</span>`;
  const named = blacklist.length ? "{ validateNin, defaultNinFormatSchema }" : "{ validateNin }";
  const head = `<span class="c-kw">import</span> ${named} <span class="c-kw">from</span> <span class="c-str">'@sierrafy/sdk/nin'</span>;\n\n`;
  const opts = blacklist.length
    ? `, {\n  schema: { ...defaultNinFormatSchema, blacklist: [${blacklist.map(q).join(", ")}] },\n}`
    : "";
  return `${head}<span class="c-kw">const</span> result = validateNin(${q(nin)}${opts});\n\n<span class="c-com">// result.valid → see the Response tab</span>`;
}

function plainCall(nin, blacklist) {
  const q = (s) => `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  const named = blacklist.length ? "{ validateNin, defaultNinFormatSchema }" : "{ validateNin }";
  const opts = blacklist.length
    ? `, {\n  schema: { ...defaultNinFormatSchema, blacklist: [${blacklist.map(q).join(", ")}] },\n}`
    : "";
  return `import ${named} from '@sierrafy/sdk/nin';\n\nconst result = validateNin(${q(nin)}${opts});`;
}

function renderCells(value) {
  const n = Math.max(8, value.length);
  const parts = [];
  for (let i = 0; i < n; i++) {
    const ch = value[i];
    const cls = ["cell"];
    let shown = "";
    if (ch !== undefined) {
      cls.push("is-filled");
      if (!/[A-Z0-9]/.test(ch)) cls.push("is-badchar");
      if (i >= 8) cls.push("is-over");
      if (ch === " ") { cls.push("is-space"); shown = "␣"; } else shown = esc(ch);
    }
    parts.push(`<span class="${cls.join(" ")}">${shown}</span>`);
  }
  cellsEl.innerHTML = parts.join("");
  countEl.textContent = value.length;
}

const readBlacklist = () =>
  blacklistEl.value.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);

// The blocklist is a field of the format schema, not a top-level option
// (docs.sierrafy.dev/configuring-the-format). A schema is meant to be built
// once and reused — validateNin re-validates any schema it hasn't seen — so
// rebuild only when the blocklist text actually changes, not on every
// keystroke in the NIN field. defaultNinFormatSchema is frozen; spread it.
let schemaKey = null;
let schema = defaultNinFormatSchema;
function formatSchema(blacklist) {
  const key = blacklist.join("\n");
  if (key !== schemaKey) {
    schemaKey = key;
    schema = blacklist.length ? { ...defaultNinFormatSchema, blacklist } : defaultNinFormatSchema;
  }
  return schema;
}

/* ---------- Main ---------- */
let lastCall = "";
let lastJson = "";

function run({ flash = false } = {}) {
  const value = input.value;
  const blacklist = readBlacklist();
  renderCells(value);

  if (value === "") {
    statusEl.className = "status is-idle";
    statusEl.innerHTML = `<span class="status-word">Waiting for input</span><p class="status-msg">Type a NIN or pick a sample.</p>`;
    for (const li of checksEl.children) {
      li.className = "check";
      li.querySelector(".check-icon").innerHTML = ICONS.idle;
      li.querySelector(".check-state").textContent = "—";
    }
    jsonEl.innerHTML = `<span class="j-punc">// the response appears here</span>`;
    callEl.innerHTML = callSnippet("K7M2QX4P", blacklist);
    lastJson = "";
    lastCall = plainCall("K7M2QX4P", blacklist);
    timingEl.textContent = "";
    input.classList.remove("is-bad");
    return;
  }

  const t0 = performance.now();
  const result = validateNin(value, { schema: formatSchema(blacklist) });
  const ms = performance.now() - t0;

  // Status
  const ok = result.valid;
  statusEl.className = `status ${ok ? "is-valid" : "is-invalid"}`;
  const msg = ok
    ? "Structurally valid. This doesn't confirm the NIN is active in the NCRA registry — that's Phase 2."
    : typeof MESSAGES[result.error] === "function" ? MESSAGES[result.error](result) : MESSAGES[result.error] ?? "";
  statusEl.innerHTML =
    `<span class="status-word">${ok ? "Valid" : "Invalid"}</span>` +
    (ok ? "" : `<code class="status-code">${esc(result.error)}</code>`) +
    `<p class="status-msg">${esc(msg)}</p>`;
  input.classList.toggle("is-bad", !ok);

  // Checks
  for (const c of CHECKS) {
    const li = checksEl.querySelector(`[data-key="${c.key}"]`);
    const state = c.skipped ? "skip" : result.checks[c.key] ? "pass" : "fail";
    li.className = `check is-${state}`;
    li.querySelector(".check-icon").innerHTML = ICONS[state];
    li.querySelector(".check-state").textContent = { pass: "pass", fail: "fail", skip: "skipped" }[state];
    if (flash) { li.classList.remove("flash"); void li.offsetWidth; li.classList.add("flash"); }
  }

  // Code panes
  jsonEl.innerHTML = highlightJson(result);
  callEl.innerHTML = callSnippet(value, blacklist);
  lastJson = JSON.stringify(result, null, 2);
  lastCall = plainCall(value, blacklist);
  timingEl.textContent = `validated in ${ms < 0.01 ? "<0.01" : ms.toFixed(2)} ms`;
}

input.addEventListener("input", () => run());
blacklistEl.addEventListener("input", () => run());

// "/" focuses the input (handy when recording).
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
    e.preventDefault();
    input.focus();
    input.select();
  }
});

/* ---------- Tabs (WAI-ARIA) ---------- */
const tabs = [...document.querySelectorAll('[role="tab"]')];
function selectTab(tab) {
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute("aria-selected", on);
    t.tabIndex = on ? 0 : -1;
    $(t.getAttribute("aria-controls")).hidden = !on;
  }
}
tabs.forEach((t, i) => {
  t.addEventListener("click", () => selectTab(t));
  t.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    selectTab(next);
    next.focus();
  });
});

/* ---------- Copy ---------- */
const copyBtn = $("copy");
copyBtn.addEventListener("click", async () => {
  const onCall = $("tab-call").getAttribute("aria-selected") === "true";
  const text = onCall ? lastCall : lastJson;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copyBtn.classList.add("is-copied");
    copyBtn.querySelector("span").textContent = "Copied";
    copyBtn.setAttribute("aria-label", "Copied");
    setTimeout(() => {
      copyBtn.classList.remove("is-copied");
      copyBtn.querySelector("span").textContent = "Copy";
      copyBtn.setAttribute("aria-label", "Copy");
    }, 1600);
  } catch {}
});

/* ---------- Theme ---------- */
const root = document.documentElement;
const themeBtn = document.querySelector(".theme-toggle");
const meta = document.querySelector('meta[name="theme-color"]');
function currentTheme() {
  return root.getAttribute("data-theme") || "dark"; // dark by default, like sierrafy.dev
}
function applyTheme(t) {
  root.setAttribute("data-theme", t);
  meta.setAttribute("content", t === "light" ? "#F5F8F6" : "#0C110E");
  themeBtn.setAttribute("aria-label", t === "light" ? "Switch to dark theme" : "Switch to light theme");
}
applyTheme(currentTheme());
themeBtn.addEventListener("click", () => {
  const next = currentTheme() === "light" ? "dark" : "light";
  applyTheme(next);
  try { localStorage.setItem("sfy-theme", next); } catch {}
});

run();
