# Secret Santa Calculator

A single-page app that takes a list of people and randomly assigns each one
a secret santa (someone else on the list) to give a gift to. No backend —
everything runs client-side.

## Stack

- React + TypeScript
- [Vite+](https://viteplus.dev) — unified toolchain (Vite, Vitest, oxlint, oxfmt)

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Checks

```bash
npm run lint   # oxlint
npm test       # vitest
npx vp check   # format + lint + type-check together
```
