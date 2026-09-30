/**
 * R35 parity test: superseded-method absence, candidate-only connector data, schematic cabinet
 * subdivisions and the no-electrical rule.
 */
import { describe, expect, it } from 'vitest';
import { compileR35, findOperation, readWorkJson } from './helpers';

function collectNumbers(value: unknown, out: number[] = []): number[] {
  if (typeof value === 'number') out.push(value);
  else if (Array.isArray(value)) for (const item of value) collectNumbers(item, out);
  else if (value !== null && typeof value === 'object') for (const item of Object.values(value)) collectNumbers(item, out);
  return out;
}

function keysOf(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) for (const item of value) keysOf(item, out);
  else if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      out.add(key);
      keysOf(item, out);
    }
  }
  return out;
}

describe('R35 superseded-method absence', () => {
  const { bundle, compiled } = compileR35();

  it('has no nailer tool, nail material or nailed connection anywhere', () => {
    for (const tool of bundle.tools) {
      expect(/nailer|nail gun|nail strip|framing nail/i.test(`${tool.id} ${tool.name}`), tool.id).toBe(false);
    }
    for (const material of bundle.materials) {
      expect(/nailer|nail gun|nail strip|framing nail/i.test(`${material.id} ${material.name}`), material.id).toBe(false);
      expect(material.quantityProposed).not.toBe(102);
      expect(material.quantityProposed).not.toBe(336);
    }
    for (const connection of bundle.connections.connections) {
      expect(connection.method).not.toBe('nail');
    }
    for (const spec of bundle.connections.fastenerSpecs) {
      expect(/nailer|nail gun|nail strip|framing nail/i.test(`${spec.id} ${spec.name}`), spec.id).toBe(false);
    }
    for (const part of bundle.parts) {
      expect(/nailer|nail gun|nail strip|framing nail/i.test(`${part.id} ${part.name}`), part.id).toBe(false);
    }
    // Mentioning the superseded method is only allowed as an explicit not-required/absent statement.
    const texts = [JSON.stringify(bundle.operations), JSON.stringify(bundle.issues)];
    for (const text of texts) {
      for (const match of text.matchAll(/[^"]{0,100}nail[^"]{0,100}/gi)) {
        const snippet = match[0];
        const allowed = /not |no |never|supersed|absent|removed|nonselect|no longer|required|salvage nail/i.test(snippet);
        expect(allowed, `unexpected nail mention: ${snippet}`).toBe(true);
      }
    }
  });

  it('carries no R27 counts or superseded layout numbers in the semantic fields', () => {
    const semantic = {
      parts: bundle.parts,
      materials: bundle.materials,
      operations: bundle.operations,
      measurements: bundle.measurements,
      connections: bundle.connections,
    };
    const text = JSON.stringify(semantic);
    expect(text.includes('nine-sheet')).toBe(false);
    expect(text.includes('336-screw')).toBe(false);
    expect(text.includes('102-nail')).toBe(false);
    expect(text.includes('R27')).toBe(false);
    const numbers = collectNumbers(semantic);
    for (const forbidden of [102, 336, 2590.8, 8534.4, 3860.8, 3949.7]) {
      expect(numbers, `forbidden superseded number ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('has no flat assembly, tilt-up or framing-nailer story', () => {
    for (const operation of compiled.operations) {
      expect(JSON.stringify(operation.view.recipe).includes('layFlat'), operation.id).toBe(false);
      expect(/tilt-up|flat assembly|nailer method/i.test(operation.title), operation.id).toBe(false);
    }
    for (const step of compiled.steps) {
      expect(/raise|tilt|flat assembl/i.test(step.title), step.id).toBe(false);
      expect(step.title.toLowerCase()).not.toContain('nail');
    }
    const carryForward = readWorkJson<{ entries: { status: string; sourceValue: string; normalizedValue: string }[] }>('carry-forward-map.json');
    const superseded = carryForward.entries.filter((entry) => entry.status === 'superseded');
    expect(superseded.length).toBeGreaterThanOrEqual(10);
    expect(superseded.some((entry) => /nailer/i.test(entry.sourceValue))).toBe(true);
  });

  it('has no synthetic-fixture anatomy (header, king/jack, cripples, door opening)', () => {
    for (const part of bundle.parts) {
      expect(/\bheader\b|\bking\b|\bjack\b|\bcripple\b|wall-a/i.test(part.id), part.id).toBe(false);
    }
    for (const part of compiled.parts) {
      if (part.kind === 'opening') {
        expect(part.assemblyId, part.id).toBe('assembly.fixtures');
        expect(part.role, part.id).toBe('clearance');
      }
    }
    expect(bundle.parts.some((part) => part.id === 'part.wall-a.opening')).toBe(false);
    expect(bundle.parts.some((part) => part.id.includes('stud-1') && !part.id.includes('stud-s'))).toBe(false);
  });
});

describe('R35 connector candidate-only parity', () => {
  const { bundle } = compileR35();

  it('keeps every connection candidate-only with held house quantities', () => {
    for (const connection of bundle.connections.connections) {
      expect(connection.declaredReleaseStatus, connection.id).not.toBe('ready');
      if (connection.id === 'connection.practice.angle-scrap') {
        expect(connection.declaredReleaseStatus).toBe('conditional');
      } else {
        expect(connection.declaredReleaseStatus).toBe('held');
        expect(connection.holdReason ?? '', connection.id).toMatch(/held|unresolved|candidate/i);
      }
      if (connection.pattern !== null && connection.pattern !== undefined) {
        expect(connection.pattern.count ?? 0, connection.id).toBeLessThanOrEqual(8);
      }
    }
    const payload = JSON.stringify(bundle.connections);
    expect(payload).not.toContain('installedQuantity');
    expect(payload).not.toContain('installed_quantity');
    expect(payload).not.toContain('angles_per_joint');
    expect(payload).not.toContain('"allowed"');
    expect(payload).not.toMatch(/"capacity"\s*:/);
    const keys = keysOf(bundle.connections);
    for (const forbidden of ['installedQuantity', 'installed_quantity', 'angles_per_joint', 'allowed', 'orientation', 'capacity']) {
      expect(keys.has(forbidden), forbidden).toBe(false);
    }
    const numbers = collectNumbers(bundle.connections);
    for (const capacity of [640, 495, 695, 845, 260, 295, 320, 170, 150]) {
      expect(numbers, `capacity value ${capacity}`).not.toContain(capacity);
    }
    const spec = bundle.connections.fastenerSpecs[0];
    expect(spec?.id).toBe('fastener.sd9112');
    expect(spec?.lengthMm).toBeCloseTo(38.1, 6);
    expect(spec?.description ?? '').toMatch(/held|not substitutes/i);
  });

  it('keeps cabinet subdivisions schematic, never authoritative parts', () => {
    for (const part of bundle.parts) {
      expect(/fixture\.(b[123]|f[12])(\b|$)/.test(part.id), part.id).toBe(false);
    }
    const baseRow = bundle.parts.find((part) => part.id === 'part.fixture.base-row');
    expect(baseRow?.description).toMatch(/individual measured widths are null/i);
    expect(baseRow?.description).toMatch(/schematic/i);
    expect(bundle.issues.some((issue) => issue.id === 'issue.r35.cabinet-seams')).toBe(true);
  });

  it('has no electrical system, part or installation operation and no electricalUS capability', () => {
    expect(bundle.systems).toEqual([]);
    for (const part of bundle.parts) {
      expect(part.trade, part.id).not.toBe('electrical');
      expect(/electrical|cable|junction|outlet|circuit/i.test(`${part.id} ${part.name}`), part.id).toBe(false);
    }
    for (const operation of bundle.operations) {
      expect(['route', 'terminate'], operation.id).not.toContain(operation.kind);
    }
    const capabilityNames = bundle.manifest.capabilities.map((capability) => capability.name).sort();
    expect(capabilityNames).toEqual(['cabinetry', 'drywall', 'woodFraming']);
    expect(JSON.stringify(bundle.manifest)).not.toContain('electricalUS');
  });
});

describe('R35 supersession record', () => {
  it('records the owner change to in-place screws and metal angles', () => {
    const { bundle } = compileR35();
    const stage = findOperation(bundle.operations, 'op.stage-tools');
    expect(JSON.stringify(stage.parameters)).toMatch(/No framing nailer or framing nail strips are required or used/i);
    expect(bundle.project.description).toMatch(/In-place construction/i);
  });
});
