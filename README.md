# Sierrafy Playground

A small site for testing Sierrafy packages **as published** and for recording short walkthrough videos. Page 1 covers the NIN validator (`@sierrafy/sdk/nin` → `validateNin()`).

The playground only ever imports `@sierrafy/sdk` the way a developer would. It never imports source from the main repo, so it tests what's actually in the package.

## Run it

```bash
pnpm install
pnpm dev        # http://localhost:5188
pnpm smoke      # checks the installed package against the documented behaviour
pnpm build      # static site in dist/
```

The dev server is pinned to port 5188 (preview to 5189) rather than Vite's default 5173, which every Vite
project on a machine competes for. Browser state is per-origin, so a service worker left on `localhost:5173`
by another app gets served to this one. A clash on 5188 now fails loudly instead of silently hopping ports.

`pnpm smoke` is the only automated check. It's plain Node with a case table at the top of `scripts/smoke.mjs` — edit that array to add or narrow cases.

## What it's testing

`@sierrafy/sdk` is on npm, so `package.json` tracks the released package and the page badge reads green **"from npm"** with the exact version. The amber **"local build · not published"** badge appears automatically when the dependency is a `file:` or `link:` spec, so a video recorded against an unreleased build can't be mistaken for the npm release.

The API the page exercises, per [docs.sierrafy.dev](https://docs.sierrafy.dev):

```js
import { validateNin, defaultNinFormatSchema } from '@sierrafy/sdk/nin';

const result = validateNin('K7M2QX4P', {
  schema: { ...defaultNinFormatSchema, blacklist: ['TEST0000'] },
});
```

Three things are easy to get wrong, and the playground gets them right so you can copy from it:

- **Import `@sierrafy/sdk/nin`, not the package root.** The subpath is the validator alone. The root re-exports OCR, which pulls `node:fs`/`node:path` into a browser bundle.
- **The blocklist lives in the format schema**, not in a top-level option. There is no `blacklist` option.
- **`validateNin` never throws for any input.** `null`, numbers and objects come back as `INVALID_LENGTH` with `nin: ""`. Only a malformed `options.schema` throws.

Checksum stays off: the only wired algorithm is Luhn, which runs over decimal digits and so rejects the all-letter NINs seen on real cards. The UI shows that check as *skipped*.

### Test a package before publishing it

```bash
# in the sierrafy monorepo
pnpm --filter @sierrafy/sdk pack --pack-destination ../sierrafy-playground/vendor

# in the playground
pnpm add ./vendor/sierrafy-sdk-<version>.tgz
pnpm smoke && pnpm dev
```

This catches packaging problems (missing files, wrong `exports`, broken types) before they reach npm. Afterwards, `pnpm add @sierrafy/sdk@latest` puts you back on the released package.

If a release changes the contract, `pnpm smoke` tells you where; update `src/main.js` and `scripts/smoke.mjs` together, since they encode the same expectations.

## Recording tips

- Press `/` to jump to the input.
- The sample chips walk through every rule in order: valid → lowercase → too short → space → symbol → Personal ID Number → blocklist. That's a ready-made script for a 60–90 s video.
- Use the theme toggle to match whatever you're recording for (dark reads better on LinkedIn video).
- Only use sample values. `K7M2QX4P` and `TEST0000` are fictional.

## Deploy

Live at **https://play.sierrafy.dev** (Netlify project `play-sierrafy`).

Pushes to `main` on [SUBiango/sierrafy-playground](https://github.com/SUBiango/sierrafy-playground) build and
publish automatically. Pull requests get their own deploy preview URL, so a change can be watched running
before it reaches the live domain.

```bash
netlify deploy --build            # draft URL, for checking before it goes live
netlify deploy --build --prod     # publish to play.sierrafy.dev
```

There is no CI build: this directory isn't a git repo, so deploys are pushed from a machine that has `netlify link` already run against the project. `--build` runs the `netlify.toml` build command locally first, so what you preview is what ships.

`netlify.toml` sets the caching split (fingerprinted `/assets/*` immutable, `index.html` always revalidated) and the response headers. Two worth knowing:

- `X-Robots-Tag: noindex` backs up the `<meta name="robots">` tag, so the playground never competes with sierrafy.dev in search.
- The CSP sets `connect-src 'none'` and `form-action 'none'`. The page's promise is that a NIN typed into it never leaves the browser, and this makes that enforceable rather than just true by inspection — if a future change adds a network call, it fails loudly instead of quietly shipping.

DNS for `sierrafy.dev` is Netlify-managed, so the subdomain record was created automatically and the existing `*.sierrafy.dev` wildcard certificate covers it. HTTPS is forced.

## Adding the next page

When the OCR package ships, add a page in the same style. Keep image demos to the Sierrafy specimen card, with the gateway running locally, until consent and data-protection review is done. Don't add a public upload endpoint.
