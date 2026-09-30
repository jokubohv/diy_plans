/**
 * R35 coverage test: one truthful row per PDF page 1-29, every named record resolving to the
 * authored bundle, and the mandatory page families mapped to steps/records.
 */
import { describe, expect, it } from 'vitest';
import type { Issue, Measurement, Part, ReleaseRecord, SourceRef, SourcesFile, Tool, ViewPreset } from '@diyguide/schema';
import { bundleJson, compileR35, readWorkJson } from './helpers';

interface CoverageRow {
  page: number;
  title: string;
  disposition: 'represented' | 'reference_only' | 'excluded';
  entityIds: string[];
  operationIds: string[];
  stepIds: string[];
  viewIds: string[];
  citationIds: string[];
  releaseStatus: string;
  notes: string;
}

interface CoverageFile {
  summary: { pages: number; represented: number; reference_only: number; excluded: number };
  rows: CoverageRow[];
}

const MANDATORY_FAMILIES: { family: string; pages: number[]; expectStepIds?: string[]; expectEntities?: string[] }[] = [
  { family: 'survey', pages: [4], expectStepIds: ['step.p4-survey'] },
  { family: 'trim', pages: [5], expectStepIds: ['step.p5-trim-survey', 'step.p5-trim-removal'] },
  { family: 'setup/logistics', pages: [7], expectStepIds: ['step.p7-setup'] },
  { family: 'W1 framing', pages: [8, 9], expectStepIds: ['step.p8-w1-layout', 'step.p9-w1-studs'] },
  { family: 'W2 framing', pages: [11, 12], expectStepIds: ['step.p11-w2-layout', 'step.p12-w2-frame'] },
  { family: 'connector/ESR', pages: [10], expectStepIds: ['step.p10-connector'] },
  { family: 'practice/SD9112', pages: [13, 14], expectStepIds: ['step.p13-practice', 'step.p14-sd9112'] },
  { family: 'slab/tile', pages: [15], expectStepIds: ['step.p15-slab'] },
  { family: 'straightening', pages: [17], expectStepIds: ['step.p17-straightening'] },
  { family: 'backing', pages: [18, 19], expectStepIds: ['step.p18-backing', 'step.p19-backing-connection'] },
  { family: 'EX1', pages: [20], expectStepIds: ['step.p20-ex1'] },
  { family: 'drywall faces', pages: [21, 22] },
  { family: 'corners/junction', pages: [23, 24] },
  { family: 'finish/baseboard', pages: [26], expectStepIds: ['step.p26-finish'] },
  { family: 'fixtures', pages: [27], expectStepIds: ['step.p27-cabinets', 'step.p27-refrigerator'] },
  { family: 'gates/release', pages: [28], expectStepIds: ['step.p28-gates'] },
  { family: 'source record', pages: [29], expectStepIds: ['step.p29-source-record'] },
];

describe('R35 coverage matrix', () => {
  const coverage = readWorkJson<CoverageFile>('coverage-matrix.json');
  const { bundle } = compileR35();
  const knownIds = new Set<string>([
    ...bundle.parts.map((part) => part.id),
    ...bundle.datums.map((datum) => datum.id),
    ...bundle.measurements.map((measurement) => measurement.id),
    ...bundle.assemblies.map((assembly) => assembly.id),
    ...bundle.materials.map((material) => material.id),
    ...bundle.tools.map((tool) => tool.id),
    ...bundle.connections.connections.map((connection) => connection.id),
    ...bundle.connections.fastenerSpecs.map((spec) => spec.id),
    ...bundle.operations.map((operation) => operation.id),
    ...bundle.steps.map((step) => step.id),
    ...bundle.views.map((view) => view.id),
    ...bundle.issues.map((issue) => issue.id),
    ...bundle.project.releases.map((release) => release.id),
    ...bundle.sources.sources.map((source: SourceRef) => source.id),
    ...bundle.sources.citations.map((citation) => citation.id),
  ]);
  const knownOperations = new Set(bundle.operations.map((operation) => operation.id));
  const knownSteps = new Set(bundle.steps.map((step) => step.id));
  const knownViews = new Set(bundle.views.map((view: ViewPreset) => view.id));
  const knownCitations = new Set(bundle.sources.citations.map((citation) => citation.id));

  it('has exactly one row per page 1-29 with a valid disposition', () => {
    expect(coverage.rows).toHaveLength(29);
    expect(coverage.rows.map((row) => row.page)).toEqual(Array.from({ length: 29 }, (_, index) => index + 1));
    expect(coverage.summary.pages).toBe(29);
    for (const row of coverage.rows) {
      expect(['represented', 'reference_only', 'excluded']).toContain(row.disposition);
      expect(row.title.length).toBeGreaterThan(5);
      expect(row.notes.length).toBeGreaterThan(5);
      expect(row.releaseStatus.length).toBeGreaterThan(2);
    }
  });

  it('names at least one entity/operation/citation for every represented page and no blank claims', () => {
    for (const row of coverage.rows) {
      if (row.disposition !== 'represented') continue;
      expect(row.entityIds.length + row.operationIds.length + row.citationIds.length, `page ${row.page}`).toBeGreaterThan(0);
      for (const id of [...row.entityIds, ...row.operationIds, ...row.stepIds, ...row.viewIds, ...row.citationIds]) {
        expect(knownIds.has(id), `page ${row.page}: unknown record ${id}`).toBe(true);
      }
    }
  });

  it('covers the mandatory page families from the owner brief', () => {
    for (const family of MANDATORY_FAMILIES) {
      for (const page of family.pages) {
        const row = coverage.rows.find((candidate) => candidate.page === page);
        expect(row, `${family.family} page ${page}`).toBeDefined();
        expect(row?.disposition, `${family.family} page ${page}`).toBe('represented');
      }
      const rows = family.pages.map((page) => coverage.rows.find((candidate) => candidate.page === page)).filter((row): row is CoverageRow => row !== undefined);      const stepIds = new Set(rows.flatMap((row) => row.stepIds));
      if (family.expectStepIds) {
        for (const expected of family.expectStepIds) {
          expect(stepIds.has(expected), `${family.family} names ${expected}`).toBe(true);
          expect(knownSteps.has(expected)).toBe(true);
        }
      }
    }
  });

  it('keeps every named operation/step/view/citation resolvable', () => {
    for (const row of coverage.rows) {
      for (const id of row.operationIds) expect(knownOperations.has(id), `page ${row.page} op ${id}`).toBe(true);
      for (const id of row.stepIds) expect(knownSteps.has(id), `page ${row.page} step ${id}`).toBe(true);
      for (const id of row.viewIds) expect(knownViews.has(id), `page ${row.page} view ${id}`).toBe(true);
      for (const id of row.citationIds) expect(knownCitations.has(id), `page ${row.page} citation ${id}`).toBe(true);
    }
  });

  it('keeps every page release status consistent with the JSON releases dictionary', () => {
    const releases = bundle.project.releases as ReleaseRecord[];
    const held = new Set(releases.filter((release) => release.state === 'held').map((release) => release.id));
    const readyPages = new Set([1, 4, 5, 7, 13, 14]);
    for (const row of coverage.rows) {
      if (readyPages.has(row.page)) {
        expect(row.releaseStatus.toLowerCase(), `page ${row.page} ready scope`).toMatch(/ready/);
      } else {
        expect(row.releaseStatus.toLowerCase(), `page ${row.page} hold scope`).toMatch(/held|conditional/);
      }
    }
    // The ready releases are exactly the survey and practice scopes.
    expect(releases.filter((release) => release.state === 'ready').map((release) => release.id).sort()).toEqual(['release.r35.practice', 'release.r35.survey']);
    expect(held.size).toBeGreaterThanOrEqual(8);
  });

  it('has issues/measurements/tools/parts backing the addendum records', () => {
    const entityIds = new Set(coverage.rows.flatMap((row) => row.entityIds));
    for (const id of ['part.fixture.fridge', 'measurement.cabinets.combined', 'part.practice.stock', 'fastener.sd9112', 'issue.r35.esr-opposing-angle']) {
      expect(entityIds.has(id), `addendum record ${id} appears in coverage`).toBe(true);
    }
    const measurements = bundle.measurements as Measurement[];
    expect(measurements.find((measurement) => measurement.id === 'measurement.ceiling.reported')).toBeDefined();
    const tools = bundle.tools as Tool[];
    expect(tools.some((tool) => tool.id === 'tool.hex-nutsetter')).toBe(true);
    const parts = bundle.parts as Part[];
    expect(parts.length).toBe(89);
    const issues = bundle.issues as Issue[];
    expect(issues.length).toBeGreaterThanOrEqual(30);
    expect(bundle.sources.sources.length).toBeGreaterThanOrEqual(50);
    expect(bundle.sources.citations.length).toBeGreaterThanOrEqual(300);
  });
});
