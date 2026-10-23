# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page Vite site that demos `@sierrafy/sdk`'s `validateNin()` in the browser, and doubles as a recording set for short walkthrough videos. It also acts as a packaging smoke test: it consumes the SDK **only as an installed package**, never as source.

Not a git repository. The SDK itself lives in the sibling monorepo at `../sierrafy` (`packages/core`, published as `@sierrafy/sdk`) — that repo has its own CLAUDE.md. Never add a path/workspace link to it here; doing so defeats the point of the playground.

## Commands

```bash
pnpm install
pnpm dev        # http://localhost:5188
pnpm smoke      # node scripts/smoke.mjs — asserts the installed package against the spec
pnpm build      # static site in dist/
pnpm preview    # serve dist/ on http://localhost:5189
```

The ports are pinned in `vite.config.js` with `strictPort`, deliberately off Vite's default 5173: browser state is
per-origin, and a service worker left on `localhost:5173` by another Vite project on this machine will be served
to this one, which looks like a broken build. Don't "fix" a port clash by letting Vite hop to the next free port.

There is no lint step and no test runner. `pnpm smoke` is the only automated check; it is plain Node with a hand-rolled case table, so "run a single test" means commenting out cases or editing the `cases` array in `scripts/smoke.mjs`.

To test an unpublished SDK build before it reaches npm:

```bash
pnpm --filter @sierrafy/sdk pack --pack-destination ../sierrafy-playground/vendor   # in ../sierrafy
pnpm add ./vendor/sierrafy-sdk-<version>.tgz                                        # here
pnpm smoke && pnpm dev
```

## Architecture

Four files carry everything:

- `vite.config.js` — reads the `@sierrafy/sdk` spec from `package.json` and the resolved version from the installed `package.json`, then injects a `__SDK__` global (`{ name, version, source }`). `source` is `"local"` when the spec starts with `file:`/`link:`, otherwise `"npm"`. This drives the amber "local build · not published" vs. green "from npm" badge, so a recorded video can never misrepresent what was tested.
- `index.html` — the whole DOM. `src/main.js` fills empty containers (`#chips`, `#checks`, `#json`, `#call`, `#pkg`) by id rather than owning markup. An inline head script applies the saved theme from `localStorage["sfy-theme"]` before first paint.
- `src/main.js` — the single `@sierrafy/sdk` import plus one `run()` function re-invoked on every input event. It renders four things from one `validateNin()` call: the per-character cell strip, the status block, the `CHECKS` list, and the two code panes (highlighted JSON response + a copy-pasteable call snippet). JSON and code highlighting are hand-written regex passes over escaped HTML — `esc()` runs before highlighting, so keep that order when touching them.
- `src/style.css` — design tokens mirrored from the sierrafy.dev landing page. Dark is the default; `:root[data-theme="light"]` overrides. `.dark-island` re-declares the dark tokens locally so code blocks stay dark in both themes. Keep new colors as tokens, not literals.

## The SDK contract

The authority is https://docs.sierrafy.dev (`/nin-validation`, `/configuring-the-format`), cross-checked against `node_modules/@sierrafy/sdk/dist/*.d.ts`.

```ts
validateNin(input: unknown, options?: { schema?: NinFormatSchema }): NinValidationResult
```

Things that are easy to get wrong:

- **Import the `/nin` subpath, not the package root.** `@sierrafy/sdk/nin` is the validator alone; the root re-exports OCR, which pulls `node:fs`/`node:path` into the browser bundle (Vite externalizes them, so the code would throw if reached). Root import built 41 modules / 27 kB of JS; the subpath builds 18 / 14.6 kB.
- **There is no `blacklist` option.** The blocklist is a field of the format schema: `validateNin(nin, { schema: { ...defaultNinFormatSchema, blacklist: [...] } })`. `defaultNinFormatSchema` is frozen, so spread it. In Node, `loadNinFormatSchema(json)` validates and freezes a schema from disk — load once at startup, not per request.
- **It never throws for any `input`.** `null`, numbers and objects come back as `{ valid: false, error: "INVALID_LENGTH", nin: "" }` — note `nin` is `""`, not the input. A malformed `options.schema` *does* throw `InvalidNinFormatSchemaError`; that's a developer error, not user input.
- **Error codes**, in precedence order (first failing check wins): `INVALID_LENGTH`, `INVALID_CHARSET`, `INVALID_CHECKSUM`, `BLACKLISTED`. There is no `INVALID_TYPE`.
- **`checks.checksum` is `true` when checksum is disabled**, which it always is. Keep `checksum.enabled: false`: the only wired algorithm is Luhn, which runs over decimal digits and so rejects the all-letter NINs seen on real cards. The UI renders this check as "skipped" rather than reading the boolean.

`src/main.js` and `scripts/smoke.mjs` duplicate these expectations — change them together.

## Deployment

Netlify project `play-sierrafy` → https://play.sierrafy.dev. Deploys are manual from a linked working copy (`netlify deploy --build [--prod]`); there's no git remote and therefore no CI build. Always check the draft URL before `--prod`.

`netlify.toml` holds the build, cache and header config. The CSP's `connect-src 'none'` is load-bearing: the page's claim is that a NIN never leaves the browser, so anything that needs a network call needs that claim revisited first, not the header widened.

## Conventions

- Sample NINs must stay fictional (`K7M2QX4P`, `TEST0000`). The privacy note and the `noindex` meta are deliberate.
- The sample chips are ordered as a video script: valid → lowercase → too short → space → symbol → Personal ID Number → blocklist. Keep that order when adding samples.
- Validation stays in-browser; no network calls, no upload endpoint. When the OCR page is added, keep image demos to the Sierrafy specimen card with the gateway running locally until consent and data-protection review is done.
- Tabs and the status region are wired for WAI-ARIA (roving tabindex, arrow keys, `aria-live`). Preserve that when editing the result panel.
