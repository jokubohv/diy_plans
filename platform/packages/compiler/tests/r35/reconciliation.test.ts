/**
 * R35 reconciliation test: 46/25/12/17 CSV inputs reconcile exactly, exclusions carry reasons,
 * spare stock never becomes an installed part and no material is double counted as an assembly
 * and a leaf.
 */
import { describe, expect, it } from 'vitest';
import type { Part } from '@diyguide/schema';
import { bundleJson, compileR35, readWorkJson } from './helpers';

interface ReconciliationRow {
  row: number;
  id: string;
  disposition: 'represented' | 'excluded' | 'merged';
  entityIds: string[];
  reason: string;
}

interface ReconciliationFile {
  file: string;
  inputRows: number;
  rows: ReconciliationRow[];
  totals: { inputRows: number; representedEntities: number; excluded: number; merged: number; spareOnly: number };
  notes: string;
}

interface Reconciliation {
  files: ReconciliationFile[];
  totals: { inputRows: number; representedEntities: number; excluded: number; merged: number; spareOnly: number };
}

const EXPECTED = [
  ['parts-R33-CONCEPT.csv', 46],
  ['cabinet-backing-R31-CONCEPT.csv', 25],
  ['drywall-panel-schedule-R34-CONCEPT.csv', 12],
  ['materials-R35-CONCEPT.csv', 17],
] as const;

describe('R35 CSV reconciliation', () => {
  const reconciliation = readWorkJson<Reconciliation>('reconciliation.json');
  const { bundle, compiled, report } = compileR35();
  const partIds = new Set(bundle.parts.map((part) => part.id));

  it('has the four inventory files with the exact input row counts', () => {
    for (const [fileName, expected] of EXPECTED) {
      const file = reconciliation.files.find((candidate) => candidate.file.endsWith(fileName));
      expect(file, fileName).toBeDefined();
      expect(file?.inputRows).toBe(expected);
      expect(file?.rows).toHaveLength(expected);
    }
  });

  it('reconciles each file and the grand totals exactly', () => {
    for (const file of reconciliation.files) {
      const totals = file.totals;
      expect(totals.inputRows + 0).toBe(file.inputRows);
      expect(totals.representedEntities + totals.excluded + totals.merged + totals.spareOnly).toBe(file.inputRows);
    }
    expect(reconciliation.totals).toEqual({ inputRows: 100, representedEntities: 68, excluded: 4, merged: 28, spareOnly: 0 });
    const sum = reconciliation.files.reduce(
      (acc, file) => ({
        inputRows: acc.inputRows + file.totals.inputRows,
        representedEntities: acc.representedEntities + file.totals.representedEntities,
        excluded: acc.excluded + file.totals.excluded,
        merged: acc.merged + file.totals.merged,
        spareOnly: acc.spareOnly + file.totals.spareOnly,
      }),
      { inputRows: 0, representedEntities: 0, excluded: 0, merged: 0, spareOnly: 0 },
    );
    expect(sum).toEqual(reconciliation.totals);
  });

  it('explains every exclusion and merge with a reason', () => {
    for (const file of reconciliation.files) {
      for (const row of file.rows) {
        expect(row.row).toBeGreaterThan(0);
        expect(row.reason.length, `${file.file} ${row.id} reason`).toBeGreaterThan(10);
        if (row.disposition === 'excluded') expect(row.entityIds).toEqual([]);
      }
    }
    const excluded = reconciliation.files.flatMap((file) => file.rows).filter((row) => row.disposition === 'excluded');
    expect(excluded.map((row) => row.id).sort()).toEqual(['F-OTHER', 'O-EX1', 'S-SHIM', 'T-BASE']);
    const merged = reconciliation.files.flatMap((file) => file.rows).filter((row) => row.disposition === 'merged');
    // The 25 parts-CSV blocking rows merge into the authoritative backing CSV parts (no double count).
    const blockMerges = merged.filter((row) => /^(TOP|U3LOW|U1LOW|U2LOW|BASE)-B\d+$/.test(row.id));
    expect(blockMerges).toHaveLength(25);
    for (const row of blockMerges) {
      expect(row.entityIds[0]).toMatch(/^part\.backing\./);
      expect(row.reason).toMatch(/authoritative|double counting/i);
    }
    const mergedOther = merged.filter((row) => !/^(TOP|U3LOW|U1LOW|U2LOW|BASE)-B\d+$/.test(row.id));
    expect(mergedOther.map((row) => row.id).sort()).toEqual(['F-ANGLE', 'F-SD', 'T-DRIVE']);
  });

  it('maps every represented CSV row to exactly one existing entity (no double counting)', () => {
    const seenEntityRows = new Map<string, string>();
    for (const file of reconciliation.files) {
      for (const row of file.rows) {
        if (row.disposition !== 'represented') continue;
        expect(row.entityIds).toHaveLength(1);
        const entityId = row.entityIds[0] as string;
        const previous = seenEntityRows.get(entityId);
        expect(previous, `${entityId} mapped twice (${previous} and ${file.file}:${row.id})`).toBeUndefined();
        seenEntityRows.set(entityId, `${file.file}:${row.id}`);
      }
    }
    expect(seenEntityRows.size).toBe(68);
    for (const entityId of seenEntityRows.keys()) {
      expect(partIds.has(entityId) || entityId.startsWith('material.'), entityId).toBe(true);
      if (entityId.startsWith('part.')) expect(partIds.has(entityId), entityId).toBe(true);
    }
  });

  it('never turns spare stock into an installed part', () => {
    const materials = bundle.materials;
    expect(materials.length).toBe(10);
    for (const material of materials) {
      if ((material.spareQuantity ?? 0) > 0) {
        expect(material.notes ?? '', `${material.id} spare note`).toMatch(/spare|allowance/i);
        expect(material.notes ?? '', `${material.id} never installed`).toMatch(/never installed/);
      }
      expect(partIds.has(`${material.id}-spare`)).toBe(false);
    }
    for (const part of bundle.parts) {
      expect(part.id.includes('spare'), `${part.id} must not be a spare`).toBe(false);
    }
    // The backing allowance stays on the material record; the 25 parts equal the 25 CSV rows.
    const backingParts = bundle.parts.filter((part) => part.assemblyId === 'assembly.backing');
    expect(backingParts).toHaveLength(25);
    const backingMaterial = materials.find((material) => material.id === 'material.lumber.backing');
    expect(backingMaterial?.quantityProposed).toBe(4);
    expect(backingMaterial?.spareQuantity).toBe(1);
  });

  it('has no assembly/leaf double count and no compiler warnings', () => {
    expect(report.warnings).toEqual([]);
    const parts = compiled.parts as Part[];
    const assembliesById = new Map(bundle.assemblies.map((assembly) => [assembly.id, assembly]));
    const included = parts.filter((part) => part.takeoff?.include === true);
    const byAssembly = new Map<string, Part[]>();
    for (const part of included) {
      const list = byAssembly.get(part.assemblyId) ?? [];
      list.push(part);
      byAssembly.set(part.assemblyId, list);
    }
    const ancestors = (assemblyId: string): string[] => {
      const chain: string[] = [];
      const seen = new Set<string>();
      let current = assembliesById.get(assemblyId)?.parentId ?? null;
      while (current && !seen.has(current)) {
        seen.add(current);
        chain.push(current);
        current = assembliesById.get(current)?.parentId ?? null;
      }
      return chain;
    };
    for (const [assemblyId, partsInAssembly] of byAssembly) {
      const materials = new Set(partsInAssembly.map((part) => part.materialId).filter((id): id is string => typeof id === 'string'));
      for (const ancestorId of ancestors(assemblyId)) {
        for (const ancestorPart of byAssembly.get(ancestorId) ?? []) {
          if (typeof ancestorPart.materialId === 'string' && materials.has(ancestorPart.materialId)) {
            throw new Error(`material ${ancestorPart.materialId} counted by both ${ancestorId} and ${assemblyId}`);
          }
        }
      }
    }
  });

  it('keeps the framing/backing parts exactly at the CSV row counts', () => {
    const assemblyCount = (assemblyId: string) => bundle.parts.filter((part) => part.assemblyId === assemblyId).length;
    expect(assemblyCount('assembly.w1')).toBe(14); // 12 studs + 2 plates
    expect(assemblyCount('assembly.w2')).toBe(7); // 5 studs + 2 plates
    expect(assemblyCount('assembly.backing')).toBe(25);
    expect(assemblyCount('assembly.drywall')).toBe(12);
    expect(bundle.materials.length).toBe(10);
  });
});
