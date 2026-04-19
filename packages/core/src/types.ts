/**
 * Represents a work item entity in a migration context.
 */
export interface WorkItem {
  id: number;
  title: string;
  type: string;
  state: string;
  assignedTo?: string;
  areaPath?: string;
  iterationPath?: string;
  description?: string;
  tags?: string[];
}

/**
 * Represents an Azure DevOps project.
 */
export interface Project {
  id: string;
  name: string;
  description?: string;
  url: string;
}

/**
 * Represents the result of a migration operation.
 */
export type MigrationStatus = 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped';

export interface MigrationResult {
  sourceId: number;
  targetId?: number;
  status: MigrationStatus;
  error?: string;
}
