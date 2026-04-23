export { parseBulkUpdateSpec, loadSpecFromFile, BulkUpdateSpecSchema } from './spec.js';
export type { BulkUpdateSpec, BulkUpdateOptions } from './spec.js';

export type {
  UpdateChange,
  UpdatePlanStatus,
  UpdatePlan,
  UpdateResultStatus,
  UpdateResult,
  BulkUpdateSummary,
  BulkUpdateReport,
} from './types.js';

export { selectWorkItems } from './selector.js';
export { planUpdates } from './planner.js';
export { buildPatch } from './patch-builder.js';
export type { JsonPatchOp } from './patch-builder.js';
export { executeUpdates } from './executor.js';
export type { ExecuteOptions } from './executor.js';
export { buildReport, printSummary, writeReport } from './reporter.js';
