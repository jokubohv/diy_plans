#!/usr/bin/env node
/**
 * T08 docs/examples gate (packet D, `p0.ifc-e2e`).
 *
 * Checks:
 *  1. every relative link in `README.md` and `docs/*.md` resolves on disk (anchors stripped;
 *     absolute, http(s), mailto and data URLs are ignored);
 *  2. every command named in those docs exists: `npm run <script>` in the root or the named
 *     workspace package.json, `npm test`, and files referenced by `npx`/`node`/`bash`/`python`
 *     commands under tools|scripts|packages|projects|apps|tests;
 *  3. every schema/workspace JSON file parses;
 *  4. no unfinished markers (TODO/TBD/FIXME/WIP/XXX, <placeholder>, ???) in docs tables.
 *
 * Prints a report; exits 1 when any check fails. Never marks an unexecuted check green.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const failures = [];
const passes = [];

function fail(id, detail) {
  failures.push({ id, detail });
}

function pass(id, detail) {
  passes.push({ id, detail });
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------------------------

const docFiles = [
  join(root, 'README.md'),
  ...readdirSync(join(root, 'docs'))
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => join(root, 'docs', name)),
];

// ---------------------------------------------------------------------------------------------
// 1. relative links
// ---------------------------------------------------------------------------------------------

let checkedLinks = 0;
for (const file of docFiles) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const linkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
    for (const match of line.matchAll(linkPattern)) {
      let target = match[1].trim().replace(/^<|>$/g, '');
      if (/^(https?:|mailto:|tel:|data:|#)/i.test(target)) continue;
      target = target.split('#')[0];
      if (target === '' || target.startsWith('/')) continue; // absolute site paths are not files
      const decoded = decodeURIComponent(target);
      const resolved = resolve(dirname(file), decoded);
      checkedLinks += 1;
      if (!existsSync(resolved)) {
        fail(
          'docs.relative-links',
          `${file.replace(root + '/', '')}:${index + 1} -> ${target} (missing on disk)`,
        );
      }
    }
  });
}
if (!failures.some((entry) => entry.id === 'docs.relative-links')) {
  pass('docs.relative-links', `${docFiles.length} documents, ${checkedLinks} relative links resolve`);
}

// ---------------------------------------------------------------------------------------------
// 2. commands named in docs
// ---------------------------------------------------------------------------------------------

const rootPackage = readJson(join(root, 'package.json'));
const workspacePackages = new Map();
for (const group of rootPackage.workspaces ?? []) {
  const base = join(root, group.replace(/\/\*$/, ''));
  if (!existsSync(base)) continue;
  for (const name of readdirSync(base)) {
    const packageFile = join(base, name, 'package.json');
    if (existsSync(packageFile)) {
      const pkg = readJson(packageFile);
      workspacePackages.set(pkg.name, { dir: join(base, name), scripts: pkg.scripts ?? {} });
    }
  }
}

function commandCandidates(file) {
  const text = readFileSync(file, 'utf8');
  const candidates = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    // fenced code lines and inline code spans
    const inline = [...line.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
    if (/^(npm|npx|node|bash|python|\.venv-ifc\/bin\/python)/.test(line)) candidates.push(line);
    for (const snippet of inline) {
      const trimmed = snippet.trim();
      if (/^(npm|npx|node|bash|python|\.venv-ifc\/bin\/python)/.test(trimmed)) {
        candidates.push(trimmed);
      }
    }
  }
  return candidates;
}

function referencedFileTokens(command) {
  const tokens = command.split(/\s+/).slice(1);
  return tokens.filter(
    (token) =>
      /^(tools|scripts|packages|projects|apps|tests)\//.test(token) &&
      !token.includes('*'),
  );
}

function checkCommand(file, command) {
  const label = `${file.replace(root + '/', '')}: ${command}`;
  const clean = command.split(' #')[0].trim();
  if (clean === 'npm test' || clean.startsWith('npm test ')) {
    if (!(rootPackage.scripts ?? {}).test) fail('docs.commands', `${label} (no "test" script)`);
    return;
  }
  const npmRun = clean.match(/^npm run (?!-)([\w:.-]+)/);
  if (npmRun) {
    const script = npmRun[1];
    const workspaceMatch =
      clean.match(/-w\s+(\S+)/) ?? clean.match(/--workspace[= ](\S+)/);
    if (workspaceMatch) {
      const workspace = workspacePackages.get(workspaceMatch[1]);
      if (!workspace) {
        fail('docs.commands', `${label} (unknown workspace ${workspaceMatch[1]})`);
      } else if (!(workspace.scripts ?? {})[script]) {
        fail('docs.commands', `${label} (workspace has no script "${script}")`);
      }
      return;
    }
    if (!(rootPackage.scripts ?? {})[script]) {
      fail('docs.commands', `${label} (root package.json has no script "${script}")`);
    }
    return;
  }
  if (/^npx (playwright|vitest)\b/.test(clean) || /^(node|bash|python|\.venv-ifc\/bin\/python)\b/.test(clean)) {
    for (const token of referencedFileTokens(clean)) {
      if (!existsSync(join(root, token))) {
        fail('docs.commands', `${label} (${token} does not exist)`);
      }
    }
  }
}

for (const file of docFiles) {
  for (const command of commandCandidates(file)) {
    checkCommand(file, command);
  }
}
if (!failures.some((entry) => entry.id === 'docs.commands')) {
  pass('docs.commands', 'every documented npm/node/bash/playwright command exists');
}

// ---------------------------------------------------------------------------------------------
// 3. JSON files parse
// ---------------------------------------------------------------------------------------------

const jsonFiles = [
  join(root, 'package.json'),
  ...[...workspacePackages.values()].map((workspace) => join(workspace.dir, 'package.json')),
  ...walk(join(root, 'packages', 'schema')).filter((file) => file.endsWith('.json')),
];
for (const file of jsonFiles) {
  try {
    readJson(file);
  } catch (error) {
    fail('docs.json', `${file.replace(root + '/', '')}: ${error.message}`);
  }
}
if (!failures.some((entry) => entry.id === 'docs.json')) {
  pass('docs.json', `${jsonFiles.length} JSON files parse`);
}

// ---------------------------------------------------------------------------------------------
// 4. unfinished markers in docs tables
// ---------------------------------------------------------------------------------------------

const markerPattern = /(\bTODO\b|\bTBD\b|\bFIXME\b|\bWIP\b|\bXXX\b|<placeholder>|<\s*fill|\?\?\?)/i;
for (const file of docFiles) {
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((line, index) => {
      if (!line.trim().startsWith('|')) return;
      const match = line.match(markerPattern);
      if (match) {
        fail(
          'docs.placeholders',
          `${file.replace(root + '/', '')}:${index + 1} table cell contains "${match[1]}"`,
        );
      }
    });
}
if (!failures.some((entry) => entry.id === 'docs.placeholders')) {
  pass('docs.placeholders', 'no unfinished markers in docs tables');
}

// ---------------------------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------------------------

console.log('gate-docs report');
for (const entry of passes) console.log(`[PASS] ${entry.id}: ${entry.detail}`);
for (const entry of failures) console.log(`[FAIL] ${entry.id}: ${entry.detail}`);
if (passes.length === 0 && failures.length === 0) console.log('[FAIL] docs: no checks executed');
const ok = failures.length === 0;
console.log(`gate-docs: ${ok ? 'OK' : `FAILED (${failures.length} findings)`}`);
process.exit(ok ? 0 : 1);
