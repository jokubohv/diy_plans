/**
 * R35 sources test: owner hashes, listed-input existence, privacy/citation resolution, the
 * private-to-public map and the public-release sanitization proof.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDataTree } from '../../src/index';
import type { Citation, SourceRef, SourcesFile } from '@diyguide/schema';
import {
  bundleJson,
  bundleTexts,
  compileR35,
  PROJECTS_DIR,
  R35_DIR,
  readWorkJson,
  sha256File,
  SOURCE_ROOT,
  sourcePath,
} from './helpers';
import { makeTempDir } from '../helpers';

const OWNER_HASHES: Record<string, string> = {
  'output/pdf/pantry-complete-framing-drywall-and-cabinet-plan-R35.pdf': 'b3567029aadc65b46e6e3acb31bd6815a1254fda12bbc7b263badf64848efbb7',
  'output/data/project-R35-conditional-manual.json': '307240e8a82f09c965d5e3cb9c1d7136d3305a3ca7e15f06b3f96499ebd03cc7',
  'output/pdf/pantry-wall-framing-drywall-layout-R35.pdf': '355087555d701475d28fcde04eb0a07f905724e0f034fa1338fbc3b4bdf16d80',
  'output/data/materials-R35-CONCEPT.csv': 'f87338d754d15e1cccf659bf3c61825758ae65b52f6aa9ab27b8ec0d28ed5f1b',
};

const REQUIRED_INPUTS = [
  'output/data/project-R35-conditional-manual.json',
  'output/pdf/pantry-complete-framing-drywall-and-cabinet-plan-R35.pdf',
  'output/pdf/pantry-wall-framing-drywall-layout-R35.pdf',
  'output/data/R35-change-record.md',
  'output/data/review-R35-conditional-manual.md',
  'output/data/parts-R33-CONCEPT.csv',
  'output/data/cabinet-backing-R31-CONCEPT.csv',
  'output/data/drywall-panel-schedule-R34-CONCEPT.csv',
  'output/data/materials-R35-CONCEPT.csv',
  'output/images/pantry-R33-cabinet-elevation.svg',
  'output/images/pantry-R31-truss-line-layout.svg',
  'output/images/pantry-R31-2x6-backing.svg',
  'output/images/pantry-R32-baseboard-removal-map.svg',
  'output/images/pantry-R34-drywall-layout.svg',
  'output/images/pantry-R34-wood-junction.svg',
  'output/images/pantry-R34-wall-and-gypsum-corners.svg',
  'output/reference/screws-R35/ICC-ES-ESR-3096.pdf',
  'output/reference/screws-R35/research-notes.txt',
  'output/data/lowes-cart-R35.json',
  'output/data/lowes-cart-R35-wood-reserve.json',
];

interface InventoryFile {
  path: string;
  sha256: string;
  privacy: string;
  relationship: string;
  readByPipeline: boolean;
}

describe('R35 source hashes and inventory', () => {
  it('matches all four owner-supplied hashes exactly', () => {
    for (const [relPath, expected] of Object.entries(OWNER_HASHES)) {
      expect(existsSync(sourcePath(relPath)), `${relPath} exists`).toBe(true);
      expect(sha256File(sourcePath(relPath)), relPath).toBe(expected);
    }
  });

  it('lists every section-16 current/carry-forward input with a matching on-disk hash', () => {
    const inventory = readWorkJson<{ entries: InventoryFile[] }>('source-inventory.json');
    const entries = new Map(inventory.entries.map((entry) => [entry.path, entry]));
    for (const relPath of REQUIRED_INPUTS) {
      const entry = entries.get(relPath);
      expect(entry, `${relPath} inventoried`).toBeDefined();
      expect(existsSync(sourcePath(relPath)), `${relPath} exists`).toBe(true);
      expect(sha256File(sourcePath(relPath)), `${relPath} hash`).toBe(entry?.sha256);
    }
    const pipelineEntries = inventory.entries.filter((entry) => entry.readByPipeline);
    expect(pipelineEntries.length).toBeGreaterThanOrEqual(REQUIRED_INPUTS.length);
    for (const entry of pipelineEntries) {
      expect(['current', 'carry_forward', 'reference']).toContain(entry.relationship);
      expect(['public', 'excerpt_only', 'private']).toContain(entry.privacy);
      expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
    // Raw URLs must not be recorded in the inventory; the private permit filename stays private.
    const raw = readFileSync(join(R35_DIR, '..', '..', '..', 'work', 'r35', 'source-inventory.json'), 'utf8');
    expect(raw).not.toMatch(/https?:/);
    const permitEntries = inventory.entries.filter((entry) => entry.path.startsWith('private://permit/'));
    expect(permitEntries.length).toBeGreaterThanOrEqual(3);
    for (const entry of permitEntries) expect(entry.privacy).toBe('private');
  });

  it('keeps private sources asset-free and resolves every citation to an asset or an explicit hold', () => {
    const sources = bundleJson<SourcesFile>('sources.json');
    expect(sources.sources.length).toBeGreaterThan(20);
    const byId = new Map<string, SourceRef>(sources.sources.map((source) => [source.id, source]));
    for (const source of sources.sources) {
      if (source.privacy === 'private') {
        expect(source.assetPath, `private source ${source.id} must not publish an asset`).toBeUndefined();
      }
      if (source.privacy === 'public' || source.privacy === 'excerpt_only') {
        expect(typeof source.assetPath, `${source.id} assetPath`).toBe('string');
        const asset = join(R35_DIR, source.assetPath as string);
        expect(existsSync(asset), `${source.id} asset exists`).toBe(true);
      }
    }
    for (const citation of sources.citations) {
      const source = byId.get(citation.sourceId);
      expect(source, `citation ${citation.id} source resolves`).toBeDefined();
      if (source?.privacy === 'private') {
        expect(citation.note ?? '', `citation ${citation.id} has an explicit unavailable-source hold`).toMatch(/Unavailable-source hold/);
      } else {
        expect(typeof source?.assetPath).toBe('string');
        const asset = join(R35_DIR, source?.assetPath as string);
        expect(existsSync(asset), `citation ${citation.id} asset exists`).toBe(true);
        expect(citation.kind, `citation ${citation.id} kind`).toBeDefined();
        expect(citation.region ?? citation.row ?? citation.excerpt, `citation ${citation.id} locator`).toBeDefined();
      }
    }
    // The four §16 data/PDF inputs, change record, review, permit set, ESR and carry-forward SVGs are present.
    for (const required of [
      'source.r35.manual-json',
      'source.r35.manual-pdf',
      'source.r35.layout-pdf',
      'source.r35.change-record',
      'source.r35.review',
      'source.r35.csv.parts',
      'source.r35.csv.backing',
      'source.r35.csv.panels',
      'source.r35.csv.materials',
      'source.r35.svg.r31-truss',
      'source.r35.svg.r31-backing',
      'source.r35.svg.r32-baseboard',
      'source.r35.svg.r33-cabinet-elevation',
      'source.r35.svg.r34-drywall-layout',
      'source.r35.svg.r34-wood-junction',
      'source.r35.svg.r34-corners',
      'source.r35.permit-manifest',
      'source.r35.permit-pdf',
      'source.r35.esr',
    ]) {
      expect(byId.has(required), `${required} present`).toBe(true);
    }
    expect(byId.get('source.r35.esr')?.privacy).toBe('excerpt_only');
    expect(byId.get('source.r35.permit-pdf')?.privacy).toBe('private');
  });

  it('records the private-to-public excerpt map in work/r35', () => {
    const map = readWorkJson<{ mapping: { privateSourceId: string; publicCards: { assetPath: string }[]; policy: string }[] }>('private-public-map.json');
    const ids = new Set(map.mapping.map((entry) => entry.privateSourceId));
    for (const required of ['source.r35.manual-json', 'source.r35.manual-pdf', 'source.r35.layout-pdf', 'source.r35.permit-pdf', 'source.r35.permit-manifest', 'source.r35.esr']) {
      expect(ids.has(required), `${required} mapped`).toBe(true);
    }
    const permit = map.mapping.find((entry) => entry.privateSourceId === 'source.r35.permit-pdf');
    expect(permit?.publicCards).toEqual([]);
    expect(permit?.policy).toMatch(/private identity|withheld/i);
    const esr = map.mapping.find((entry) => entry.privateSourceId === 'source.r35.esr');
    expect(esr?.publicCards.length).toBeGreaterThan(0);
  });

  it('never publishes a private asset or private identity into the release', () => {
    const outDir = makeTempDir();
    const result = buildDataTree({ projectsDir: PROJECTS_DIR, outDir, slug: 'pantry-r35' });
    expect(result.ok).toBe(true);
    const release = result.releases.find((candidate) => candidate.slug === 'pantry-r35');
    expect(release?.publishable).toBe(true);
    const releaseDir = release?.releaseDir as string;
    const manifest = JSON.parse(readFileSync(join(releaseDir, 'release-manifest.json'), 'utf8')) as { files: { path: string }[] };
    const paths = manifest.files.map((file) => file.path);
    expect(paths).not.toContain('output/pdf/pantry-complete-framing-drywall-and-cabinet-plan-R35.pdf');
    expect(paths.every((path) => path.startsWith('assets/') || path.endsWith('.json'))).toBe(true);

    const sources = bundleJson<SourcesFile>('sources.json');
    const privateAssets = sources.sources.filter((source) => source.privacy === 'private').map((source) => source.assetPath);
    for (const asset of privateAssets) {
      if (typeof asset === 'string') expect(paths).not.toContain(asset);
    }

    // No published file may contain private identity or raw source URLs (SVG namespace excepted).
    const banned = (process.env['R35_PRIVATE_MARKERS'] ?? '').split('|').filter(Boolean);
    for (const file of manifest.files) {
      const text = readFileSync(join(releaseDir, file.path), 'utf8');
      for (const marker of banned) expect(text.includes(marker), `${file.path} must not contain ${marker}`).toBe(false);
      expect(/https?:\/\/(?!www\.w3\.org)/.test(text), `${file.path} must not contain a raw source URL`).toBe(false);
    }
  });

  it('keeps the target -6.35 mm citation pointing at the parsed card region and never at a raw URL', () => {
    const sources = bundleJson<SourcesFile>('sources.json');
    const citations = sources.citations as Citation[];
    expect(citations.length).toBeGreaterThan(100);
    for (const citation of citations) {
      expect(citation.label.length).toBeGreaterThan(3);
      if (citation.excerpt !== undefined) expect(citation.excerpt.includes('http'), citation.id).toBe(false);
    }
  });
});

describe('R35 public assets', () => {
  it('contains no private identity in any authored file or asset', () => {
    const banned = (process.env['R35_PRIVATE_MARKERS'] ?? '').split('|').filter(Boolean);
    for (const { path, text } of bundleTexts()) {
      for (const marker of banned) expect(text.includes(marker), `${path} must not contain ${marker}`).toBe(false);
      expect(/https?:\/\/(?!www\.w3\.org)/.test(text), `${path} must not contain a raw source URL`).toBe(false);
    }
  });

  it('compiles the bundle with zero blocking errors and zero warnings', () => {
    const { report } = compileR35();
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(report.ok).toBe(true);
  });
});
