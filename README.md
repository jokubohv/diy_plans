# diy_plans

Reusable DIY BIM guide platform. The implementation root is [`platform/`](platform/).

- **Plan of record:** [`platform/docs/plan-p3.md`](platform/docs/plan-p3.md) (P3 revision; operative
  decisions and P0 scope as recorded in the session).
- **Frozen contracts:** [`platform/docs/architecture.md`](platform/docs/architecture.md).
- **Reference project:** [`platform/projects/pantry-r35/R35`](platform/projects/pantry-r35/R35)
  contains the sanitized Pantry R35 authored bundle. Generated hash-addressed releases stay
  untracked and are rebuilt locally with `npm run data`.

## Quick start

```bash
cd platform
npm install
npm run dev          # compiles the fixture release data + starts the site on http://localhost:5173
```

Other entry points: `npm test`, `npm run build`, `npm run gate:p0`. See
[`platform/README.md`](platform/README.md) for the full command map and
[`platform/docs/architecture.md`](platform/docs/architecture.md) for the contracts.
