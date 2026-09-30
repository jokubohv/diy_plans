#!/usr/bin/env node
/**
 * R35 umbrella gate: the authoritative Pantry R35 checks, separate from the P0 gate.
 *
 * Runs in this order and records every command's exit code, duration and tail output under
 * `work/3d-platform/evidence/r35/gate/run-<n>/`:
 *
 *   npx vitest run packages/compiler/tests/r35
 *   npx tsx packages/compiler/src/cli.ts validate --project projects/pantry-r35/R35
 *   npm run data
 *   bash scripts/ifc.sh pantry-r35
 *   npm run -w @diyguide/guide-site build
 *   node work/3d-platform/evidence/p0/ui-site/design-review/capture.mjs iter1-r35 pantry-r35
 *
 * The capture step needs the built site served on :4173. If a preview server is already
 * running it is reused; otherwise the gate starts one and stops it afterwards. A missing
 * server is reported as a failure, never as a pass.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const evidenceRoot = join(root, 'work', '3d-platform', 'evidence', 'r35', 'gate');

const STEPS = [
  { id: 'unit-r35', command: 'npx vitest run packages/compiler/tests/r35' },
  {
    id: 'validate-r35',
    command: 'npx tsx packages/compiler/src/cli.ts validate --project projects/pantry-r35/R35',
  },
  { id: 'data', command: 'npm run data' },
  { id: 'ifc-r35', command: 'bash scripts/ifc.sh pantry-r35' },
  { id: 'build', command: 'npm run -w @diyguide/guide-site build' },
  { id: 'e2e-r35', command: 'npx playwright test tests/e2e/r35.spec.ts' },
];

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
  const all = String(text ?? '').trimEnd().split(/\r?\n/);
  return all.slice(Math.max(0, all.length - lines)).join('\n');
}

async function waitForServer(url, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // server not up yet
    }
    await new Promise((done) => setTimeout(done, 500));
  }
  return false;
}

const runNumber = nextRunNumber();
const runDir = join(evidenceRoot, `run-${runNumber}`);
mkdirSync(runDir, { recursive: true });

const results = [];
let failed = false;

for (const [index, step] of STEPS.entries()) {
  const ordinal = String(index + 1).padStart(2, '0');
  console.log(`\n=== [${ordinal}] ${step.command} ===`);
  const started = Date.now();
  const execution = spawnSync(step.command, {
    shell: true,
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const duration = Date.now() - started;
  const ok = execution.status === 0;
  failed ||= !ok;
  const log = `exit=${execution.status}\n\n${execution.stdout ?? ''}\n${execution.stderr ?? ''}`;
  writeFileSync(join(runDir, `${ordinal}-${step.id}.log`), log);
  results.push({ id: step.id, command: step.command, ok, durationMs: duration });
  console.log(tail(execution.stdout, 6));
  if (!ok) console.log(tail(execution.stderr, 12));
  console.log(`--- ${step.id}: ${ok ? 'ok' : 'FAILED'} (exit ${execution.status}, ${duration} ms)`);
}

// Capture step: reuse a running :4173 server or start one for the duration of the capture.
{
  const url = 'http://localhost:4173';
  const captureCommands = [
    'node work/3d-platform/evidence/p0/ui-site/design-review/capture.mjs iter1-r35 pantry-r35',
    'node work/3d-platform/evidence/p0/ui-site/design-review/capture-r35-faces.mjs iter1-r35',
  ];
  console.log(`\n=== [${String(STEPS.length + 1).padStart(2, '0')}] R35 captures ===`);
  const started = Date.now();
  let server = null;
  let serverStarted = false;
  let ok = true;
  let output = '';
  try {
    let reachable = await waitForServer(url, 3000);
    if (!reachable) {
      server = spawn('npm', ['run', '-w', '@diyguide/guide-site', 'preview'], {
        cwd: root,
        stdio: 'ignore',
        detached: true,
      });
      reachable = await waitForServer(url, 60000);
      serverStarted = true;
    }
    if (!reachable) {
      ok = false;
      output = 'preview server did not become reachable on :4173';
    } else {
      for (const command of captureCommands) {
        const commandStarted = Date.now();
        const execution = spawnSync(command, {
          shell: true,
          cwd: root,
          encoding: 'utf8',
          maxBuffer: 64 * 1024 * 1024,
          env: { ...process.env, CAPTURE_BASE: url },
        });
        const commandOk = execution.status === 0;
        ok = ok && commandOk;
        output += `\n--- ${command}: ${commandOk ? 'ok' : 'FAILED'} (exit ${execution.status})\n${execution.stdout ?? ''}\n${execution.stderr ?? ''}`;
        results.push({
          id: 'capture-r35',
          command,
          ok: commandOk,
          durationMs: Date.now() - commandStarted,
        });
      }
    }
  } finally {
    if (serverStarted && server?.pid) {
      try {
        process.kill(-server.pid, 'SIGTERM');
      } catch {
        // server already gone
      }
    }
  }
  const duration = Date.now() - started;
  failed ||= !ok;
  writeFileSync(join(runDir, `${String(STEPS.length + 1).padStart(2, '0')}-capture.log`), output);
  console.log(tail(output, 8));
  console.log(`--- capture-r35: ${ok ? 'ok' : 'FAILED'} (${duration} ms)`);
}

const catalogPath = join(root, 'apps', 'guide-site', 'public', 'data', 'catalog.json');
let entries = [];
try {
  entries = JSON.parse(readFileSync(catalogPath, 'utf8')).entries ?? [];
} catch {
  entries = [];
}
const catalogOk =
  entries.some((entry) => entry.slug === 'p0-fixture') &&
  entries.some((entry) => entry.slug === 'pantry-r35');
failed ||= !catalogOk;
writeFileSync(
  join(runDir, 'summary.json'),
  `${JSON.stringify({ run: runNumber, catalogOk, results, failed }, null, 2)}\n`,
);
writeFileSync(
  join(runDir, 'summary.md'),
  [
    `# Pantry R35 gate run-${runNumber}`,
    '',
    `- catalogue has p0-fixture and pantry-r35: ${catalogOk ? 'yes' : 'NO'}`,
    ...results.map(
      (result) =>
        `- ${result.ok ? 'pass' : 'FAILED'} \`${result.command}\` (${result.durationMs} ms)`,
    ),
    '',
    failed ? 'Result: **FAILED**' : 'Result: **OK**',
    '',
  ].join('\n'),
);

console.log('\n================ gate:r35 summary ================');
for (const result of results) {
  console.log(
    `${result.ok ? 'pass  ' : 'failed'}  ${result.durationMs} ms  ${result.command}`,
  );
}
console.log(`evidence: ${runDir}`);
console.log(`gate:r35: ${failed ? 'FAILED' : 'OK'}`);
process.exit(failed ? 1 : 0);
