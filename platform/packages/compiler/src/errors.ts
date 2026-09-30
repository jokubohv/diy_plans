/**
 * Compiler error contract (architecture.md §6, frozen error object shape).
 *
 * Error object: { code, file, jsonPath, objectId, expected, actual, sourceRefIds }
 * plus a severity so the validation flow can separate blocking errors from warnings.
 */
export type GuideErrorCode =
  | 'MISSING_FILE'
  | 'SCHEMA_INVALID'
  | 'DUPLICATE_ID'
  | 'DANGLING_REF'
  | 'UNSAFE_PATH'
  | 'MISSING_CITATION'
  | 'READY_OP_MISSING_PARAMETERS'
  | 'MISSING_FASTENER_PATTERN'
  | 'MISSING_CONNECTION_SPEC'
  | 'INVALID_CUT_OPERATION_REF'
  | 'CONFLICTED_MEASUREMENT_WITHOUT_ISSUE'
  | 'CYCLIC_DEPENDENCY'
  | 'COVERAGE_BEFORE_INSPECTION'
  | 'SUPERSEDED_DEPENDENCY'
  | 'UNSUPPORTED_CAPABILITY'
  | 'ACCEPTANCE_REJECTED'
  | 'SCHEDULE_INCONSISTENT'
  | 'TAKEOFF_DOUBLE_COUNT';

export const BLOCKING_CODES: ReadonlySet<GuideErrorCode> = new Set([
  'MISSING_FILE',
  'SCHEMA_INVALID',
  'DUPLICATE_ID',
  'DANGLING_REF',
  'UNSAFE_PATH',
  'MISSING_CITATION',
  'READY_OP_MISSING_PARAMETERS',
  'MISSING_FASTENER_PATTERN',
  'MISSING_CONNECTION_SPEC',
  'INVALID_CUT_OPERATION_REF',
  'CONFLICTED_MEASUREMENT_WITHOUT_ISSUE',
  'CYCLIC_DEPENDENCY',
  'COVERAGE_BEFORE_INSPECTION',
  'SUPERSEDED_DEPENDENCY',
  'UNSUPPORTED_CAPABILITY',
  'ACCEPTANCE_REJECTED',
]);

export type GuideErrorSeverity = 'blocking' | 'warning';

export interface GuideError {
  code: GuideErrorCode;
  file: string;
  jsonPath: string;
  objectId: string | null;
  expected: string;
  actual: string;
  sourceRefIds: string[];
  severity: GuideErrorSeverity;
}

export interface GuideErrorInit extends Partial<Omit<GuideError, 'code'>> {
  code: GuideErrorCode;
}

/** Build a GuideError with sensible defaults; severity follows the frozen code table. */
export function guideError(init: GuideErrorInit): GuideError {
  return {
    code: init.code,
    file: init.file ?? '$',
    jsonPath: init.jsonPath ?? '$',
    objectId: init.objectId ?? null,
    expected: init.expected ?? '',
    actual: init.actual ?? '',
    sourceRefIds: init.sourceRefIds ?? [],
    severity: init.severity ?? (BLOCKING_CODES.has(init.code) ? 'blocking' : 'warning'),
  };
}

export function formatGuideError(error: GuideError): string {
  const where = `${error.file}${error.jsonPath && error.jsonPath !== '$' ? ` ${error.jsonPath}` : ''}`;
  const object = error.objectId ? ` [${error.objectId}]` : '';
  const refs = error.sourceRefIds.length > 0 ? ` (refs: ${error.sourceRefIds.join(', ')})` : '';
  return `${error.severity.toUpperCase()} ${error.code}${object}: ${where}: expected ${error.expected}; actual ${error.actual}${refs}`;
}

export function formatGuideErrors(errors: GuideError[], limit = 50): string[] {
  return errors.slice(0, limit).map(formatGuideError);
}
