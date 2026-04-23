import type { MigrationResult, WorkItem } from '@clothed-stability/core';
import type { IAdoClient } from '@clothed-stability/ado-client';
import type { Logger } from '@clothed-stability/utils';
import type { IMigrator } from './types.js';

const SOURCE_WIQL =
  'SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project ORDER BY [System.Id] ASC';

export class WorkItemMigrator implements IMigrator {
  readonly name = 'WorkItemMigrator';

  constructor(
    private readonly source: IAdoClient,
    private readonly sourceProject: string,
    private readonly target: IAdoClient,
    private readonly targetProject: string,
    private readonly logger: Logger,
    private readonly concurrency: number = 2,
  ) {}

  async run(dryRun: boolean): Promise<MigrationResult[]> {
    this.logger.info({ sourceProject: this.sourceProject }, 'Querying source work items');
    const workItems = await this.source.queryWorkItems(this.sourceProject, SOURCE_WIQL);
    this.logger.info({ count: workItems.length }, 'Found work items to migrate');

    if (workItems.length === 0) {
      return [];
    }

    const results: MigrationResult[] = [];
    await this.runWithConcurrency(workItems, this.concurrency, async (item) => {
      const result = await this.migrateOne(item, dryRun);
      results.push(result);
    });

    const succeeded = results.filter((r) => r.status === 'completed').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    this.logger.info({ total: results.length, succeeded, failed, skipped }, 'Migration complete');

    return results;
  }

  private async migrateOne(item: WorkItem, dryRun: boolean): Promise<MigrationResult> {
    if (dryRun) {
      this.logger.info({ sourceId: item.id, title: item.title, type: item.type }, '[dry-run] Would migrate work item');
      return { sourceId: item.id, status: 'skipped' };
    }

    try {
      const fields = buildFields(item, this.sourceProject, this.targetProject);
      const created = await this.target.createWorkItem(this.targetProject, item.type, fields);
      this.logger.info(
        { sourceId: item.id, targetId: created.id, title: item.title },
        'Migrated work item',
      );
      return { sourceId: item.id, targetId: created.id, status: 'completed' };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error({ sourceId: item.id, error }, 'Failed to migrate work item');
      return { sourceId: item.id, status: 'failed', error };
    }
  }

  private async runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    fn: (item: T) => Promise<void>,
  ): Promise<void> {
    let index = 0;

    async function worker(): Promise<void> {
      while (index < items.length) {
        const item = items[index++] as T;
        await fn(item);
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
    await Promise.all(workers);
  }
}

function buildFields(item: WorkItem, sourceProject: string, targetProject: string): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    'System.Title': item.title,
  };

  if (item.state) fields['System.State'] = item.state;
  if (item.description) fields['System.Description'] = item.description;
  if (item.tags && item.tags.length > 0) fields['System.Tags'] = item.tags.join('; ');
  if (item.assignedTo) fields['System.AssignedTo'] = item.assignedTo;
  if (item.areaPath) fields['System.AreaPath'] = item.areaPath.replace(sourceProject, targetProject);
  if (item.iterationPath) fields['System.IterationPath'] = item.iterationPath.replace(sourceProject, targetProject);

  return fields;
}

