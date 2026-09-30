#!/usr/bin/env node
/**
 * P0 umbrella gate (packet D, `p0.ifc-e2e`).
 *
 * Runs the mandatory checks in the frozen order and records every command's exit code, duration
 * and tail output under `work/3d-platform/evidence/p0/gate/run-<n>/`:
 *
 *   npm run typecheck
 *   npx vitest run
 *   npm run data
 *   bash scripts/ifc.sh
 *   npm run -w @diyguide/guide-site build
 *   npx playwright test tests/e2e/thin-journey.spec.ts
 *   npx playwright test tests/e2e/ux.spec.ts tests/e2e/sequence.spec.ts
 *   npx playwright test tests/e2e/viewer-render.spec.ts
 *   npx playwright test tests/e2e/accessibility.spec.ts
 *   node scripts/gate-docs.mjs
 *
 * The UX step carries the owner's core sequencing regression suite (`sequence.spec.ts`) as well as
 * the responsive/fallback checks; `MANDATORY_E2E_SPECS` below fails the gate if a required spec
 * stops being referenced by a mandatory step, so the oracle cannot silently shrink.
 *
 * The APS comparison has no credentials in this environment and is recorded as
 * `not_evaluated` — it is never printed as a pass. Exit code is non-zero when any mandatory
 * step fails; the raw per-step logs stay in the evidence directory.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const evidenceRoot = join(root, 'work', '3d-platform', 'evidence', 'p0', 'gate');

/** Every spec that must be executed by some mandatory step (guard against silent removal). */
const MANDATORY_E2E_SPECS = [
  'tests/e2e/thin-journey.spec.ts',
  'tests/e2e/ux.spec.ts',
  'tests/e2e/sequence.spec.ts',
  'tests/e2e/viewer-render.spec.ts',
  'tests/e2e/accessibility.spec.ts',
];

const STEPS = [
  { id: 'typecheck', command: 'npm run typecheck', mandatory: true },
  { id: 'unit-tests', command: 'npx vitest run', mandatory: true },
  { id: 'data', command: 'npm run data', mandatory: true },
  // ifc.sh writes model/project.ifc into the published data tree, so it must run after `data` and
  // before the site build (which copies public/ into dist/). `npm run build` would re-run `data`
  // and wipe the model again, hence the workspace-scoped Vite build here.
  { id: 'ifc', command: 'bash scripts/ifc.sh', mandatory: true },
  { id: 'build', command: 'npm run -w @diyguide/guide-site build', mandatory: true },
  { id: 'e2e-thin', command: 'npx playwright test tests/e2e/thin-journey.spec.ts', mandatory: true },
  { id: 'e2e-ux', command: 'npx playwright test tests/e2e/ux.spec.ts tests/e2e/sequence.spec.ts', mandatory: true },
  {
    id: 'e2e-viewer-render',
    command: 'npx playwright test tests/e2e/viewer-render.spec.ts',
    mandatory: true,
  },
  {
    id: 'e2e-accessibility',
    command: 'npx playwright test tests/e2e/accessibility.spec.ts',
    mandatory: true,
  },
  { id: 'docs', command: 'node scripts/gate-docs.mjs', mandatory: true },
];

const APS = {
  status: 'not_evaluated',
  reason:
    'No APS credentials exist in this environment (packet D): the APS viewer comparison was not run and is not a pass.',
};

/**
 * Guard against the mandatory oracle silently shrinking: every required spec must be executed by
 * a mandatory step. Checked before any step runs so a gate run cannot record a partial oracle.
 */
function missingMandatorySpecs() {
  const mandatoryCommands = STEPS.filter((step) => step.mandatory).map((step) => step.command);
  return MANDATORY_E2E_SPECS.filter(
    (spec) => !mandatoryCommands.some((command) => command.includes(spec)),
  );
}

const missingSpecs = missingMandatorySpecs();
if (missingSpecs.length > 0) {
  console.error('gate:p0 refuses to run: mandatory e2e specs are not covered by any step:');
  for (const spec of missingSpecs) console.error(`  - ${spec}`);
  console.error('Update scripts/gate-p0.mjs so every MANDATORY_E2E_SPECS entry runs in a step.');
  process.exit(1);
}

function nextRunNumber() {
  if (!existsSync(evidenceRoot)) return 1;
  let max = 0;
  for (const name of readdirSync(evidenceRoot)) {
    const match = name.match(/^run-(\d+)$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

function tail(text, lines = 40) {
  const all = text.trimEnd().split(/\r?\n/);
  return all.slice(Math.max(0, all.length - lines)).join('\n');
}

function main() {
  const runNumber = nextRunNumber();
  const runDir = join(evidenceRoot, `run-${runNumber}`);
  mkdirSync(runDir, { recursive: true });

  const results = [];
  let failed = false;

  for (const [index, step] of STEPS.entries()) {
    const ordinal = String(index + 1).padStart(2, '0');
    console.log(`\n=== [${ordinal}/${STEPS.length}] ${step.command} ===`);
    const started = Date.now();
    const execution = spawnSync(step.command, {
      cwd: root,
      shell: true,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    const durationMs = Date.now() - started;
    const output = `${execution.stdout ?? ''}${execution.stderr ?? ''}`;
    const exitCode = execution.status === null ? -1 : execution.status;
    const notRun = exitCode !== 0 && /not_run:/.test(output);
    const ok = exitCode === 0;
    if (!ok && step.mandatory) failed = true;

    const logFile = `step-${ordinal}-${step.id}.log`;
    writeFileSync(
      join(runDir, logFile),
      `$ ${step.command}\nexit: ${exitCode}\nduration: ${durationMs} ms\n\n${output}`,
      'utf8',
    );
    console.log(tail(output, 25));
    console.log(
      `--- ${step.id}: ${ok ? 'ok' : notRun ? 'not_run' : 'FAILED'} (exit ${exitCode}, ${durationMs} ms)`,
    );

    results.push({
      index: index + 1,
      id: step.id,
      command: step.command,
      mandatory: step.mandatory,
      status: ok ? 'pass' : notRun ? 'not_run' : 'failed',
      exitCode,
      durationMs,
      log: logFile,
      tail: tail(output),
    });
  }

  const summary = {
    run: runNumber,
    startedAt: new Date().toISOString(),
    mandatoryFailures: results.filter((entry) => entry.mandatory && entry.status !== 'pass').length,
    steps: results,
    aps: APS,
  };
  writeFileSync(join(runDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  const lines = [
    `# gate:p0 run-${runNumber}`,
    '',
    '| # | Step | Command | Status | Exit | Duration | Log |',
    '|---|---|---|---|---|---|---|',
    ...results.map(
      (entry) =>
        `| ${entry.index} | ${entry.id} | \`${entry.command}\` | ${entry.status} | ${entry.exitCode} | ${entry.durationMs} ms | ${entry.log} |`,
    ),
    '',
    `APS: ${summary.aps.status} — ${summary.aps.reason}`,
    '',
    `Mandatory failures: ${summary.mandatoryFailures}`,
    '',
  ];
  writeFileSync(join(runDir, 'summary.md'), lines.join('\n'), 'utf8');
  writeFileSync(
    join(runDir, 'aps.json'),
    `${JSON.stringify(summary.aps, null, 2)}\n`,
    'utf8',
  );

  console.log('\n================ gate:p0 summary ================');
  for (const entry of results) {
    console.log(
      `${entry.status.padEnd(8)} exit=${String(entry.exitCode).padEnd(3)} ${String(entry.durationMs).padStart(7)} ms  ${entry.command}`,
    );
  }
  console.log(`APS: ${summary.aps.status} (${summary.aps.reason})`);
  console.log(`evidence: ${runDir}`);
  console.log(`gate:p0: ${failed ? 'FAILED' : 'OK'}`);
  process.exit(failed ? 1 : 0);
}

main();
