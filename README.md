# clothed-stability

A Node.js CLI tool for migrating Azure DevOps projects between organizations — built as a production-quality TypeScript monorepo.

---

## Repository Structure

```
/packages
  /core          – shared domain types, config schema, config loader (Zod)
  /ado-client    – Azure DevOps REST API wrapper (placeholder, typed interface)
  /migrators     – migration implementations (placeholder)
  /cli           – CLI entrypoint (Commander: migrate / validate / dry-run)
  /utils         – shared utilities: structured logging (pino), retry/throttle

/test-fixtures   – sample JSON data for tests
/docs            – architecture and planning docs
/.github
  /workflows     – CI (install → build → lint → test)
```

---

## Tech Stack

| Concern       | Library / Tool              |
|---------------|-----------------------------|
| Language      | TypeScript (strict mode)    |
| Runtime       | Node.js ≥ 20                |
| Package mgr   | pnpm workspaces             |
| Testing       | Vitest                      |
| Schema        | Zod                         |
| Logging       | pino                        |
| CLI           | Commander                   |
| Linting       | ESLint (typescript-eslint)  |
| Formatting    | Prettier                    |

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9 (`npm install -g pnpm`)

### Install Dependencies

```bash
pnpm install
```

### Build All Packages

```bash
pnpm build
```

### Run Tests

```bash
pnpm test
```

### Lint

```bash
pnpm lint
```

### Run the CLI

```bash
pnpm cli --help
# or after building:
node packages/cli/dist/index.js --help
```

Example output:

```
Usage: ado-migrate [options] [command]

Azure DevOps migration tool

Options:
  -V, --version   output the version number
  -h, --help      display help for command

Commands:
  migrate         Run the full migration from source to target Azure DevOps organization
  validate        Validate a migration config file without running a migration
  dry-run         Preview what a migration would do without making any changes
  help [command]  display help for command
```

---

## Configuration

Commands accept a `-c / --config` option pointing to a JSON file.  
See [`test-fixtures/sample-config.json`](test-fixtures/sample-config.json) for the expected shape.

```json
{
  "source": {
    "organizationUrl": "https://dev.azure.com/source-org",
    "project": "SourceProject",
    "auth": {
      "type": "pat",
      "tokenEnvVar": "ADO_SOURCE_PAT"
    }
  },
  "target": {
    "organizationUrl": "https://dev.azure.com/target-org",
    "project": "TargetProject",
    "auth": {
      "type": "pat",
      "tokenEnvVar": "ADO_TARGET_PAT"
    }
  },
  "execution": {
    "dryRun": false,
    "logLevel": "info",
    "concurrency": 2
  }
}
```

`validate` checks both source and target Azure DevOps connections and requires the PAT environment variables referenced by `source.auth.tokenEnvVar` and `target.auth.tokenEnvVar` to be set before running.

---

## Bulk Update

The `bulk-update` command updates existing work items **in place** within a single Azure DevOps project — no cross-project copying involved.

### Purpose and Use Cases

- Bulk-set a field across many work items (e.g., set priority, assign owner)
- Add or remove tags across a query result
- Clear stale fields
- Tag a set of items with a marker after a process runs

### Spec File

Create a JSON spec file describing what to select and what to change:

```json
{
  "project": "MyProject",
  "selection": {
    "ids": [101, 102, 103],
    "wiql": "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'"
  },
  "operations": {
    "setFields": {
      "System.Priority": 2
    },
    "clearFields": ["System.Description"],
    "addTags": ["reviewed"],
    "removeTags": ["pending-review"]
  },
  "options": {
    "dryRun": true,
    "skipClosedItems": true,
    "continueOnError": true,
    "batchSize": 25,
    "markerTag": "bulk-updated-2024"
  }
}
```

**Selection:** Provide `ids`, `wiql`, or both. When both are provided their results are **unioned** (de-duplicated).

**Operations:** At least one operation must be specified. Supported operations:

| Operation     | Description |
|---------------|-------------|
| `setFields`   | Set field values (only applies if current value differs) |
| `clearFields` | Set fields to `null` (only applies if currently non-null) |
| `addTags`     | Add tags (skipped if tag already present, case-insensitive) |
| `removeTags`  | Remove tags (skipped if tag not present, case-insensitive) |

### Safety Notes

- **`dryRun` defaults to `true`** — you must explicitly set `"dryRun": false` in your spec or omit `--dry-run` to run live.
- Closed items (`Closed`, `Done`, `Removed`, `Resolved`) are skipped by default. Set `"skipClosedItems": false` to override.
- `continueOnError: true` (default) means failures on individual items are recorded without aborting the run.
- A report JSON is written after every run (default: `./bulk-update-report.json`).

### Dry Run (safe preview)

```bash
node packages/cli/dist/index.js bulk-update \
  -c migration-config.json \
  -s bulk-update-spec.json \
  --dry-run
```

### Live Execution

```bash
node packages/cli/dist/index.js bulk-update \
  -c migration-config.json \
  -s bulk-update-spec.json
```

### Additional CLI Options

```
-c, --config <path>    Migration config (org URL + auth)
-s, --spec <path>      Bulk update spec JSON
--dry-run              Force dry-run (overrides spec)
--limit <n>            Max items to process
--ids <ids>            Comma-separated ID override (e.g. "1,2,3")
--query <wiql>         WIQL query override
--report <path>        Report output path (default: ./bulk-update-report.json)
```

### Known Limitations

- No relation/link updates
- No attachment handling
- Single-project only (no cross-project updates)
- Tags are stored as a semicolon-delimited string; ordering may change after update

---

## Architecture

See [`docs/architecture.md`](docs/architecture.md) for the full system design, dependency graph, and future migration flow.

---

## Development

### Adding a New Package

1. Create `/packages/<name>/` with a `package.json`, `tsconfig.json`, and `src/index.ts`
2. Add it to `pnpm-workspace.yaml` (already covered by `packages/*`)
3. Depend on it from other packages using `"@clothed-stability/<name>": "workspace:*"`

### Coding Standards

- No `any` types — enforced by ESLint
- Explicit return types on all exported functions
- All API calls must go through `@clothed-stability/ado-client`
- No business logic in the `cli` package
- Use dependency injection where practical
