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
