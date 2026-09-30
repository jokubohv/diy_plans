/**
 * Validation entry points for the canonical DIY Guide Bundle (0.1.0).
 *
 * The JSON Schema files under src/ are canonical. This module exposes Ajv validators for the
 * authored files and the compiled guide, plus small capability helpers. It performs no
 * filesystem access; the compiler owns reading a bundle directory.
 */
import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import bundleSchema from './diy-guide-0.1.0.schema.json';
import compiledSchema from './diy-guide-compiled-0.1.0.schema.json';
import { AUTHORED_FILE_NAMES, type AuthoredFileName, type Capability } from './types';

export * from './types';

export const BUNDLE_SCHEMA_ID = 'https://diyguide.local/schema/0.1.0/bundle.json';
export const COMPILED_SCHEMA_ID = 'https://diyguide.local/schema/0.1.0/compiled.json';
export const SCHEMA_VERSION = '0.1.0';

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
  allowUnionTypes: true,
  validateFormats: true,
});
addFormats(ajv);
ajv.addSchema(bundleSchema as Record<string, unknown>, BUNDLE_SCHEMA_ID);
ajv.addSchema(compiledSchema as Record<string, unknown>, COMPILED_SCHEMA_ID);

export interface SchemaIssue {
  keyword: string;
  instancePath: string;
  schemaPath: string;
  message: string;
  params: unknown;
}

export interface ValidationResult {
  valid: boolean;
  issues: SchemaIssue[];
}

function toIssues(errors: ErrorObject[] | null | undefined): SchemaIssue[] {
  if (!errors) return [];
  return errors.map((e) => ({
    keyword: e.keyword,
    instancePath: e.instancePath === '' ? '$' : `$${e.instancePath}`,
    schemaPath: e.schemaPath,
    message: e.message ?? 'schema violation',
    params: e.params,
  }));
}

const FILE_SCHEMAS: Record<AuthoredFileName, { kind: 'array' | 'object'; pointer: string }> = {
  'manifest.json': { kind: 'object', pointer: '/$defs/manifest' },
  'project.json': { kind: 'object', pointer: '/$defs/project' },
  'datums.json': { kind: 'array', pointer: '/$defs/datum' },
  'measurements.json': { kind: 'array', pointer: '/$defs/measurement' },
  'sources.json': { kind: 'object', pointer: '/$defs/sourcesFile' },
  'assemblies.json': { kind: 'array', pointer: '/$defs/assembly' },
  'parts.json': { kind: 'array', pointer: '/$defs/part' },
  'connections.json': { kind: 'object', pointer: '/$defs/connectionsFile' },
  'materials.json': { kind: 'array', pointer: '/$defs/material' },
  'tools.json': { kind: 'array', pointer: '/$defs/tool' },
  'systems.json': { kind: 'array', pointer: '/$defs/system' },
  'operations.json': { kind: 'array', pointer: '/$defs/operation' },
  'steps.json': { kind: 'array', pointer: '/$defs/step' },
  'views.json': { kind: 'array', pointer: '/$defs/view' },
  'issues.json': { kind: 'array', pointer: '/$defs/issue' },
  'acceptance.json': { kind: 'object', pointer: '/$defs/acceptance' },
  'listing.json': { kind: 'object', pointer: '/$defs/listing' },
};

export { AUTHORED_FILE_NAMES };
export type { AuthoredFileName };

const fileValidators = new Map<AuthoredFileName, ValidateFunction>();
const compiledValidator = ajv.compile({
  $id: 'https://diyguide.local/validators/compiled-guide',
  $ref: COMPILED_SCHEMA_ID,
});

export function validateAuthoredFile(file: AuthoredFileName, data: unknown): ValidationResult {
  let validator = fileValidators.get(file);
  if (!validator) {
    const spec = FILE_SCHEMAS[file];
    if (!spec) throw new Error(`Unknown authored file: ${file}`);
    const ref = `${BUNDLE_SCHEMA_ID}#${spec.pointer}`;
    validator = ajv.compile(
      spec.kind === 'array'
        ? {
            $id: `https://diyguide.local/validators/${file}`,
            type: 'array',
            items: { $ref: ref },
          }
        : { $id: `https://diyguide.local/validators/${file}`, $ref: ref },
    );
    fileValidators.set(file, validator);
  }
  const valid = validator(data) as boolean;
  return { valid, issues: valid ? [] : toIssues(validator.errors) };
}

export function validateCompiledGuide(data: unknown): ValidationResult {
  const valid = compiledValidator(data) as boolean;
  return { valid, issues: valid ? [] : toIssues(compiledValidator.errors) };
}

export function formatSchemaIssues(issues: SchemaIssue[], limit = 25): string[] {
  return issues
    .slice(0, limit)
    .map((i) => `${i.instancePath} ${i.message} (${i.keyword})`);
}

/**
 * Compiler capability contract: a bundle may require capabilities the runtime does not provide.
 * Required-but-unsupported capabilities must reject the bundle instead of degrading silently.
 */
export function findUnsupportedCapabilities(
  required: Capability[],
  supported: Capability[],
): Capability[] {
  const have = new Map(supported.map((c) => [c.name, c.version]));
  return required.filter((c) => {
    const v = have.get(c.name);
    return v === undefined || v < c.version;
  });
}
