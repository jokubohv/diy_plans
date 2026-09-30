# DIY guide platform — developer entry

Node >= 22.12, npm >= 10. Python 3.12 with a local venv for IfcOpenShell lives at
`platform/.venv-ifc` (created by `tools/ifc/setup.sh`).

## First run

```bash
npm install
npm run dev        # compiles fixture release data, then serves the site (http://localhost:5173)
```

`npm run dev` regenerates `apps/guide-site/public/data` from `projects/p0-fixture/0.1.0` and then
starts Vite. The library opens on `/`; the fixture page is `/plans/p0-fixture` and the embed route
is `/embed/p0-fixture/<releaseId>`.

## Command map

| Command | Meaning |
|---|---|
| `npm run dev` | data + dev server |
| `npm run build` | data + production build of the site |
| `npm run preview` | serve the production build on :4173 |
| `npm test` | all vitest unit/contract/integration tests |
| `npm run typecheck` | TypeScript for every workspace |
| `npm run gate:contracts` | T01 slice: schema/compiler contracts + negative fixtures |
| `npm run gate:operations` | T03 slice: status propagation, step states, overlays |
| `npm run gate:viewer` | T04 slice: viewer-core + frame math |
| `npm run gate:bim` | T02 slice: IFC generation + checks (Python/IfcOpenShell) |
| `npm run gate:thin-e2e` | T07 slice: browser journey over the built site |
| `npm run gate:ux` | T05 slice: desktop viewports, reduced motion, fallback |
| `npx playwright test tests/e2e/sequence.spec.ts` | frame-first sequencing regression (initial task, phase order, BOM/cut list, held chain) |
| `npx playwright test tests/e2e/viewer-render.spec.ts` | canvas render regression (decoded pixels; fails on an empty scene or lost camera framing) |
| `npx playwright test tests/e2e/accessibility.spec.ts` | axe-core (4 surfaces × desktop/mobile), landmarks, live region, keyboard |
| `npm run gate:docs` | T08 slice: docs/examples consistency |
| `npm run gate:p0` | umbrella gate: 10 mandatory steps; the UX step runs `ux.spec.ts` **and** the mandatory `sequence.spec.ts` (12 tests), and the gate refuses to run if any required spec is not covered |

## Layout

`packages/schema` (canonical contracts) → `packages/compiler` (authored → compiled) →
`packages/viewer-core`/`viewer-three` (engine boundary) → `packages/guide-ui` + `apps/guide-site`
(site) → `tools/ifc` (BIM) → `tests/e2e` (Playwright).

Docs: [`docs/architecture.md`](docs/architecture.md) (frozen contracts),
[`docs/fixture-p0.md`](docs/fixture-p0.md) (fixture spec),
[`docs/plan-p3.md`](docs/plan-p3.md) (plan of record), [`docs/p0-decision.md`](docs/p0-decision.md)
(P0 result).

Evidence: `work/3d-platform/evidence/p0/<packet>/<run>/` per plan §15.
