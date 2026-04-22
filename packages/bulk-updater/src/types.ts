import type { WorkItem } from '@clothed-stability/core';
import type { BulkUpdateSpec } from './spec.js';

export interface UpdateChange {
  setFields?: Record<string, string | number | boolean | null>;
  clearFields?: string[];
  tagsToAdd?: string[];
  tagsToRemove?: string[];
}

export type UpdatePlanStatus = 'pending' | 'skipped' | 'planned';

export interface UpdatePlan {
  workItem: WorkItem;
  status: UpdatePlanStatus;
  skipReason?: string;
  change: UpdateChange;
}

export type UpdateResultStatus = 'updated' | 'skipped' | 'failed';

export interface UpdateResult {
  id: number;
  title: string;
  type: string;
  status: UpdateResultStatus;
  skipReason?: string;
  error?: string;
}

export interface BulkUpdateSummary {
  totalMatched: number;
  totalPlanned: number;
  totalUpdated: number;
  totalSkipped: number;
  totalFailed: number;
}

export interface BulkUpdateReport {
  spec: BulkUpdateSpec;
  dryRun: boolean;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  summary: BulkUpdateSummary;
  items: UpdateResult[];
}
