/**
 * Shared helpers for the Pantry R35 conversion tests.
 *
 * The authored bundle lives at platform/projects/pantry-r35/R35; the work artifacts at
 * platform/work/r35; the immutable source tree is the owner-supplied folder (override with
 * R35_SOURCE_ROOT when the same fixture is mirrored elsewhere).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AuthoredBundle, CompiledGuide, Operation, Part, Step } from '@diyguide/schema';
import { compileBundle, loadAuthoredBundle, type LoadResult, type ValidationReport } from '../../src/index';

export const R35_DIR = fileURLToPath(new URL('../../../../projects/pantry-r35/R35', import.meta.url));
export const WORK_DIR = fileURLToPath(new URL('../../../../work/r35', import.meta.url));
export const PROJECTS_DIR = fileURLToPath(new URL('../../../../projects', import.meta.url));
export const SOURCE_ROOT = process.env['R35_SOURCE_ROOT'] ?? '';

export function loadR35(): LoadResult {
  const result = loadAuthoredBundle(R35_DIR);
  if (!result.bundle) {
    throw new Error(`R35 bundle failed to load: ${result.errors.map((error) => error.code).join(', ')}`);
  }
  return result;
}

export function compileR35(): { compiled: CompiledGuide; report: ValidationReport; bundle: AuthoredBundle } {
  const load = loadR35();
  const { compiled, report } = compileBundle({
    bundle: load.bundle,
    files: load.files,
    rawFiles: load.rawFiles,
    loadErrors: load.errors,
    bundleDir: R35_DIR,
  });
  if (!compiled || !report.ok || !load.bundle) throw new Error('R35 bundle did not compile');
  return { compiled, report, bundle: load.bundle };
}

export function readWorkJson<T = unknown>(name: string): T {
  const path = join(WORK_DIR, name);
  if (!existsSync(path)) throw new Error(`Missing R35 work artifact: ${path}`);
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function sourcePath(relPath: string): string {
  return join(SOURCE_ROOT, relPath);
}

export function bundleJson<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(join(R35_DIR, name), 'utf8')) as T;
}

/** Text of every authored JSON file plus every asset under the bundle, for sanitization scans. */
export function bundleTexts(): { path: string; text: string }[] {
  const texts: { path: string; text: string }[] = [];
  const files = [
    'manifest.json',
    'project.json',
    'datums.json',
    'measurements.json',
    'sources.json',
    'assemblies.json',
    'parts.json',
    'connections.json',
    'materials.json',
    'tools.json',
    'systems.json',
    'operations.json',
    'steps.json',
    'views.json',
    'issues.json',
    'acceptance.json',
    'listing.json',
    'assets/thumbnails/pantry-r35.svg',
  ];
  for (const file of files) {
    texts.push({ path: file, text: readFileSync(join(R35_DIR, file), 'utf8') });
  }
  const sourcePagesDir = join(R35_DIR, 'assets', 'source-pages');
  for (const name of readdirSync(sourcePagesDir)) {
    texts.push({ path: `assets/source-pages/${name}`, text: readFileSync(join(sourcePagesDir, name), 'utf8') });
  }
  return texts;
}

export const W1_STUD_CENTRE_POINTER = '/backing/candidate_W1_stud_centers_from_left_plate_end_in';
export const W2_FACE_STUDS_POINTER = '/drywall/panel_layout/faces/2/studs';

export function readManualJson(): Record<string, unknown> {
  return JSON.parse(readFileSync(sourcePath('output/data/project-R35-conditional-manual.json'), 'utf8')) as Record<string, unknown>;
}

export function jsonPointer<T = unknown>(obj: unknown, pointer: string): T {
  const segments = pointer.split('/').slice(1);
  let value: unknown = obj;
  for (const segment of segments) {
    if (value === null || value === undefined) throw new Error(`Pointer ${pointer} left the document at ${segment}`);
    value = (value as Record<string, unknown>)[/^\d+$/.test(segment) ? Number(segment) : segment];
  }
  return value as T;
}

export function findPart(parts: readonly Part[], id: string): Part {
  const part = parts.find((candidate) => candidate.id === id);
  if (!part) throw new Error(`Missing part ${id}`);
  return part;
}

export function findOperation(operations: readonly Operation[], id: string): Operation {
  const operation = operations.find((candidate) => candidate.id === id);
  if (!operation) throw new Error(`Missing operation ${id}`);
  return operation;
}

export function findStep(steps: readonly Step[], id: string): Step {
  const step = steps.find((candidate) => candidate.id === id);
  if (!step) throw new Error(`Missing step ${id}`);
  return step;
}

/** Transitive dependency closure of an operation (excluding itself). */
export function operationClosure(startId: string, operations: readonly Operation[]): Set<string> {
  const byId = new Map(operations.map((operation) => [operation.id, operation]));
  const result = new Set<string>();
  const stack = [...(byId.get(startId)?.dependencyOperationIds ?? [])];
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || result.has(id)) continue;
    result.add(id);
    const operation = byId.get(id);
    if (operation) stack.push(...operation.dependencyOperationIds);
  }
  return result;
}

/** Transitive prerequisite closure of a step (excluding itself). */
export function stepClosure(startId: string, steps: readonly Step[]): Set<string> {
  const byId = new Map(steps.map((step) => [step.id, step]));
  const result = new Set<string>();
  const stack = [...(byId.get(startId)?.prerequisiteStepIds ?? [])];
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || result.has(id)) continue;
    result.add(id);
    const step = byId.get(id);
    if (step) stack.push(...step.prerequisiteStepIds);
  }
  return result;
}

/** Steps that contain an operation, used for page->step topology checks. */
export function stepsForOperation(operationId: string, steps: readonly Step[]): Step[] {
  return steps.filter((step) => step.operationIds.includes(operationId));
}

export function boxXRange(part: Part): [number, number] {
  if (part.geometry.shape !== 'box') throw new Error(`${part.id} is not a box`);
  const [x] = part.geometry.sizeMm;
  const [cx] = part.placement?.translationMm ?? [0, 0, 0];
  return [(cx ?? 0) - (x ?? 0) / 2, (cx ?? 0) + (x ?? 0) / 2];
}

export function boxYRange(part: Part): [number, number] {
  if (part.geometry.shape !== 'box') throw new Error(`${part.id} is not a box`);
  const [, y] = part.geometry.sizeMm;
  const [, cy] = part.placement?.translationMm ?? [0, 0, 0];
  return [(cy ?? 0) - (y ?? 0) / 2, (cy ?? 0) + (y ?? 0) / 2];
}

export function boxZRange(part: Part): [number, number] {
  if (part.geometry.shape !== 'box') throw new Error(`${part.id} is not a box`);
  const [, , z] = part.geometry.sizeMm;
  const [, , cz] = part.placement?.translationMm ?? [0, 0, 0];
  return [(cz ?? 0) - (z ?? 0) / 2, (cz ?? 0) + (z ?? 0) / 2];
}

export function inchToMm(value: string): number {
  const exact = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!exact) throw new Error(`Not a decimal inch value: ${value}`);
  const sign = exact[1] === '-' ? -1 : 1;
  const digits = `${exact[2]}${exact[3] ?? ''}`;
  return (sign * Number(digits)) / 10 ** (exact[3] ?? '').length * 25.4;
}
