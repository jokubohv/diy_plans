#!/usr/bin/env node
/**
 * U4 model preparation and verification.
 *
 * `ensure`:
 *   For every requested plan slug, resolve its release id from the published
 *   `apps/guide-site/public/data/catalog.json` (never hard-coded) and make sure a renderable
 *   IFC exists:
 *     - if the published release tree already has `model/project.ifc`, it is used as is;
 *     - otherwise the repo's own deterministic `tools/ifc/generate_ifc.py` is invoked with the
 *       published `guide.compiled.json`, writing into `<evidence>/models/<slug>/<releaseId>/`.
 *   `not_run` (exit 2) is printed when a model is missing and the .venv-ifc toolchain is not
 *   available; nothing is faked.
 *
 * `verify --report <report.json>`:
 *   Reads the compositor report, recomputes the sha256 of the exact bytes that were served for
 *   each model, compares it with the recorded hash and validates that artifact against the
 *   published compiled guide + the project IDS with `tools/ifc/check_ifc.py`. Failures exit 1.
 *
 * Both modes update `<evidence>/models/models-manifest.json`.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const platformRoot = resolve(here, '..');
const defaultEvidence = join(
  platformRoot,
  'work',
  '3d-platform',
  'evidence',
  'p0',
  'u4-thatopen',
  'run-1',
);

const args = process.argv.slice(2);
const mode = args[0];
const evidenceArgIndex = args.indexOf('--evidence');
const evidenceDir = resolve(
  evidenceArgIndex >= 0 ? args[evidenceArgIndex + 1] : defaultEvidence,
);
const reportArgIndex = args.indexOf('--report');
const reportPath = resolve(
  reportArgIndex >= 0 ? args[reportArgIndex + 1] : join(evidenceDir, 'report.json'),
);
const modelsDir = join(evidenceDir, 'models');
const manifestPath = join(modelsDir, 'models-manifest.json');
const catalogPath = join(platformRoot, 'apps', 'guide-site', 'public', 'data', 'catalog.json');
const venvPython = join(platformRoot, '.venv-ifc', 'bin', 'python');

function failNotRun(message) {
  console.error(`not_run: ${message}`);
  process.exit(2);
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/**
 * sha256 ignoring the STEP `FILE_NAME` timestamp: the platform's IFC generator is deterministic
 * in entity order/content but stamps the current time into the header, so byte-identity is
 * never claimed. This is the comparison used to prove the evidence regeneration matches the
 * platform pipeline output.
 */
function timestampNormalizedSha256(path) {
  const data = readFileSync(path)
    .toString('latin1')
    .replace(/FILE_NAME\('','[^']*'/, "FILE_NAME('','<timestamp>'");
  return createHash('sha256').update(data, 'latin1').digest('hex');
}

function venvAvailable() {
  if (!existsSync(venvPython)) return false;
  try {
    execFileSync(venvPython, ['-c', 'import ifcopenshell, ifctester'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function idsPathFor(slug) {
  const slugDir = join(platformRoot, 'projects', slug);
  if (!existsSync(slugDir)) return null;
  for (const revision of readdirSync(slugDir)) {
    const candidate = join(slugDir, revision, 'model', 'project.ids');
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function loadCatalog(slugs) {
  if (!existsSync(catalogPath)) {
    failNotRun(`${catalogPath} is missing; run 'npm run data' first.`);
  }
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  const entries = [];
  for (const slug of slugs) {
    const entry = (catalog.entries ?? []).find((candidate) => candidate.slug === slug);
    if (!entry) {
      failNotRun(`catalog has no entry for slug ${slug}; run 'npm run data' first.`);
    }
    entries.push(entry);
  }
  return entries;
}

function loadManifest() {
  if (!existsSync(manifestPath)) return { generatedAt: null, models: {} };
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

function saveManifest(manifest) {
  mkdirSync(modelsDir, { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function requestedSlugs() {
  const slugsArgIndex = args.indexOf('--slugs');
  const raw = slugsArgIndex >= 0 ? args[slugsArgIndex + 1] : 'p0-fixture,pantry-r35';
  return raw.split(',').map((slug) => slug.trim()).filter(Boolean);
}

if (mode === 'ensure') {
  const entryPoints = loadCatalog(requestedSlugs());
  const manifest = loadManifest();
  manifest.generatedAt = new Date().toISOString();
  manifest.catalogPath = 'apps/guide-site/public/data/catalog.json';
  manifest.models = manifest.models ?? {};

  let needsToolchain = false;
  for (const entry of entryPoints) {
    const published = join(
      platformRoot,
      'apps',
      'guide-site',
      'public',
      'data',
      'releases',
      entry.slug,
      entry.releaseId,
      'model',
      'project.ifc',
    );
    if (!existsSync(published)) needsToolchain = true;
  }
  const toolchain = venvAvailable();
  if (needsToolchain && !toolchain) {
    failNotRun(
      `${venvPython} is missing or cannot import ifcopenshell/ifctester, and at least one ` +
        `published release has no model/project.ifc. Run 'bash tools/ifc/setup.sh' with PyPI access.`,
    );
  }

  for (const entry of entryPoints) {
    const published = join(
      platformRoot,
      'apps',
      'guide-site',
      'public',
      'data',
      'releases',
      entry.slug,
      entry.releaseId,
      'model',
      'project.ifc',
    );
    const compiled = join(
      platformRoot,
      'apps',
      'guide-site',
      'public',
      'data',
      'releases',
      entry.slug,
      entry.releaseId,
      'guide.compiled.json',
    );
    const generated = join(modelsDir, entry.slug, entry.releaseId, 'model', 'project.ifc');

    // Always prepare the deterministic regeneration as a fallback: the published data tree is
    // produced by `npm run data` and can be rewritten by concurrent platform runs, which wipes
    // model/*.ifc. The compositor proof prefers the published artifact when it is present and
    // records which bytes it actually served.
    if (toolchain) {
      mkdirSync(join(modelsDir, entry.slug), { recursive: true });
      const stdout = execFileSync(
        venvPython,
        ['tools/ifc/generate_ifc.py', '--compiled', compiled, '--out', generated],
        { cwd: platformRoot, encoding: 'utf8' },
      );
      writeFileSync(join(modelsDir, entry.slug, 'ifc-generate.json'), stdout);
    }

    const usePublished = existsSync(published);
    const modelPath = usePublished ? published : generated;
    const publishedNormalized = usePublished ? timestampNormalizedSha256(published) : null;
    const generatedNormalized = toolchain ? timestampNormalizedSha256(generated) : null;
    manifest.models[entry.slug] = {
      ...(manifest.models[entry.slug] ?? {}),
      slug: entry.slug,
      releaseId: entry.releaseId,
      ensuredSource: usePublished ? 'published-release' : 'regenerated-into-evidence',
      ensuredPath: modelPath,
      ensuredSha256: sha256File(modelPath),
      ensuredBytes: statSync(modelPath).size,
      ensuredSha256TimestampNormalized: usePublished ? publishedNormalized : generatedNormalized,
      fallbackPath: toolchain ? generated : null,
      fallbackSha256: toolchain ? sha256File(generated) : null,
      publishedPresent: usePublished,
      /** null when the published artifact is absent; otherwise must be true. */
      regenerationMatchesPublished:
        publishedNormalized !== null && generatedNormalized !== null
          ? publishedNormalized === generatedNormalized
          : null,
      publishedNote: usePublished
        ? null
        : 'published release tree has no model/project.ifc at evidence time (the data tree is ' +
          'rebuilt by npm run data and wipes model/); the deterministic regeneration is used',
    };
    console.log(
      `u4-prepare-models: ${entry.slug} source=${manifest.models[entry.slug].ensuredSource} ` +
        `bytes=${manifest.models[entry.slug].ensuredBytes} sha256=${manifest.models[entry.slug].ensuredSha256.slice(0, 16)} ` +
        `fallback=${toolchain ? 'prepared' : 'none'} ` +
        `matchesPublishedExceptTimestamp=${manifest.models[entry.slug].regenerationMatchesPublished === null ? 'n/a (published absent)' : manifest.models[entry.slug].regenerationMatchesPublished}`,
    );
  }
  saveManifest(manifest);
  console.log(`u4-prepare-models: manifest ${manifestPath}`);
  process.exit(0);
}

if (mode === 'verify') {
  if (!existsSync(reportPath)) {
    console.error(`verify: report not found: ${reportPath}`);
    process.exit(1);
  }
  if (!venvAvailable()) {
    failNotRun(`${venvPython} is missing or cannot import ifcopenshell/ifctester; cannot verify models.`);
  }
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const manifest = loadManifest();
  manifest.models = manifest.models ?? {};
  manifest.verifiedAt = new Date().toISOString();
  manifest.reportPath = reportPath;

  let ok = true;
  for (const [slug, model] of Object.entries(report.models ?? {})) {
    const entry = loadCatalog([slug])[0];
    const ifcUrl = model.ifcSource.ifcUrl;
    const servedPath = ifcUrl.startsWith('/data/')
      ? join(platformRoot, 'apps', 'guide-site', 'public', 'data', ifcUrl.slice('/data/'.length))
      : ifcUrl.startsWith('/u4-models/')
        ? join(modelsDir, ifcUrl.slice('/u4-models/'.length))
        : null;
    if (!servedPath || !existsSync(servedPath)) {
      console.error(`verify: cannot locate served artifact for ${slug}: ${ifcUrl}`);
      ok = false;
      continue;
    }
    const servedSha = sha256File(servedPath);
    const shaMatches = servedSha === model.ifcSource.sha256;
    const compiled = join(
      platformRoot,
      'apps',
      'guide-site',
      'public',
      'data',
      'releases',
      entry.slug,
      entry.releaseId,
      'guide.compiled.json',
    );
    const ids = idsPathFor(slug);
    const slugDir = join(modelsDir, slug);
    mkdirSync(slugDir, { recursive: true });
    const checkReportPath = join(slugDir, 'check-report.json');
    let checkOk = false;
    let checkSummary = null;
    let checkError = null;
    if (!shaMatches) {
      checkError = `served sha256 ${servedSha} does not match report sha256 ${model.ifcSource.sha256}`;
    } else if (!ids) {
      checkError = `no projects/${slug}/*/model/project.ids found`;
    } else {
      try {
        execFileSync(
          venvPython,
          [
            'tools/ifc/check_ifc.py',
            '--ifc',
            servedPath,
            '--compiled',
            compiled,
            '--ids',
            ids,
            '--slug',
            slug,
            '--report',
            checkReportPath,
          ],
          { cwd: platformRoot, stdio: 'pipe' },
        );
        checkOk = true;
        const checkReport = JSON.parse(readFileSync(checkReportPath, 'utf8'));
        checkSummary = {
          ok: checkReport.ok,
          failingChecks: (checkReport.checks ?? []).filter((check) => !check.ok).map((check) => check.id),
          idsSpecifications: (checkReport.idsSpecifications ?? []).length,
          productCounts: checkReport.productCounts,
        };
        checkOk = checkReport.ok === true;
      } catch (error) {
        checkOk = false;
        checkError = error instanceof Error ? error.message : String(error);
        if (existsSync(checkReportPath)) {
          try {
            const checkReport = JSON.parse(readFileSync(checkReportPath, 'utf8'));
            checkSummary = {
              ok: checkReport.ok,
              failingChecks: (checkReport.checks ?? [])
                .filter((check) => !check.ok)
                .map((check) => check.id),
              idsSpecifications: (checkReport.idsSpecifications ?? []).length,
              productCounts: checkReport.productCounts,
            };
          } catch {
            // Keep the raw error when the report itself cannot be parsed.
          }
        }
      }
    }
    const prior = manifest.models[slug] ?? {};
    manifest.models[slug] = {
      ...prior,
      slug,
      releaseId: entry.releaseId,
      servedUrl: ifcUrl,
      servedPath,
      servedSha256: servedSha,
      servedBytes: statSync(servedPath).size,
      sha256MatchesReport: shaMatches,
      checkOk,
      checkReport: checkOk || checkError === null ? checkReportPath : null,
      checkSummary,
      checkError,
    };
    console.log(
      `u4-prepare-models: verify ${slug} sha256Match=${shaMatches} check=${checkOk ? 'OK' : 'FAIL'} (${checkError ?? 'all checks pass'})`,
    );
    if (!shaMatches || !checkOk) ok = false;
  }
  saveManifest(manifest);
  process.exit(ok ? 0 : 1);
}

console.error('usage: u4-prepare-models.mjs ensure|verify [--evidence <dir>] [--report <report.json>] [--slugs a,b]');
process.exit(2);
