// Post-publish smoke test.
// Imports @sierrafy/sdk exactly as a developer would and checks the behaviour
// documented at docs.sierrafy.dev/nin-validation and /configuring-the-format.
// Run after every publish:  pnpm add @sierrafy/sdk@latest && pnpm smoke

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { validateNin, defaultNinFormatSchema } from "@sierrafy/sdk/nin";

const require = createRequire(import.meta.url);
const pkg = JSON.parse(readFileSync(require.resolve("@sierrafy/sdk/package.json"), "utf8"));

// The blocklist is a schema field, not a top-level option.
const withBlacklist = (...nins) => ({ schema: { ...defaultNinFormatSchema, blacklist: nins } });

// `echoed` is the expected `result.nin`; it defaults to the input, except for
// non-string input, which the validator reports as an empty string.
const cases = [
  { name: "valid sample", nin: "K7M2QX4P", valid: true },
  { name: "all letters", nin: "ABCDEFGH", valid: true },
  { name: "lowercase", nin: "k7m2qx4p", valid: false, error: "INVALID_CHARSET" },
  { name: "too short", nin: "K7M2QX", valid: false, error: "INVALID_LENGTH" },
  { name: "too long", nin: "K7M2QX4P9", valid: false, error: "INVALID_LENGTH" },
  { name: "contains space", nin: "K7M QX4P", valid: false, error: "INVALID_CHARSET" },
  { name: "symbol", nin: "K7M2-QX4", valid: false, error: "INVALID_CHARSET" },
  { name: "empty", nin: "", valid: false, error: "INVALID_LENGTH" },
  { name: "Personal ID No.", nin: "SL20230815K7M2QX4P0", valid: false, error: "INVALID_LENGTH" },
  { name: "blocklisted", nin: "TEST0000", opts: withBlacklist("TEST0000"), valid: false, error: "BLACKLISTED" },
  { name: "not blocklisted", nin: "K7M2QX4P", opts: withBlacklist("TEST0000"), valid: true },
  // Documented: never throws, for any input.
  { name: "null input", nin: null, valid: false, error: "INVALID_LENGTH", echoed: "" },
  { name: "number input", nin: 12345678, valid: false, error: "INVALID_LENGTH", echoed: "" },
  { name: "object input", nin: {}, valid: false, error: "INVALID_LENGTH", echoed: "" },
];

let failed = 0;
console.log(`\nTesting ${pkg.name}@${pkg.version}\n`);

for (const c of cases) {
  let r, problem;
  try {
    r = validateNin(c.nin, c.opts);
    if (r.valid !== c.valid) problem = `valid was ${r.valid}, expected ${c.valid}`;
    else if (!c.valid && r.error !== c.error) problem = `error was ${r.error}, expected ${c.error}`;
    else if (r.nin !== (c.echoed ?? c.nin)) problem = `nin was ${JSON.stringify(r.nin)}, expected ${JSON.stringify(c.echoed ?? c.nin)}`;
    else if (!r.checks || ["length", "charset", "checksum", "blacklist"].some((k) => typeof r.checks[k] !== "boolean"))
      problem = `checks object missing or malformed`;
  } catch (e) {
    problem = `threw: ${e.message}`;
  }
  if (problem) failed++;
  console.log(`${problem ? "✗" : "✓"} ${c.name.padEnd(18)} ${JSON.stringify(c.nin).padEnd(24)}${problem ? "  " + problem : ""}`);
}

console.log(`\n${cases.length - failed}/${cases.length} passed\n`);
process.exit(failed ? 1 : 0);
