# Architecture

## System Overview

`clothed-stability` is a Node.js CLI tool for migrating Azure DevOps projects between organizations. It is designed to be run locally or in a CI pipeline, and operates against the Azure DevOps REST API.

---

## Monorepo Structure

```
/packages
  /core          – shared domain types, config schema, config loader
  /ado-client    – Azure DevOps REST API wrapper (all ADO calls live here)
  /migrators     – individual migration implementations
  /cli           – CLI entrypoint (Commander-based)
  /utils         – shared utilities: structured logging (pino), retry/throttle

/test-fixtures   – sample JSON data for integration tests
/docs            – architecture and planning docs
/.github
  /workflows     – CI pipelines (install, build, lint, test)
```

---

## Dependency Graph

```
cli ──────────────────┬──► core
                      └──► utils

ado-client ───────────┬──► core
                      └──► utils

migrators ────────────┬──► core
                      └──► utils
                      └──► ado-client (future)
```

No circular dependencies.  
Business logic is isolated in `core` and `migrators`.  
The `cli` layer contains no business logic — it parses arguments and delegates.

---

## Design Decisions

### pnpm Workspaces
- Provides fast, deterministic installs
- Native workspace protocol for internal packages (`workspace:*`)
- Supports per-package scripts and isolated `node_modules`

### TypeScript – Strict Mode
- `strict: true` enabled globally
- `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` also enabled
- Target: `ES2022` / `NodeNext` modules for top-level `await` and native ESM

### Zod for Config Validation
- Runtime schema validation of the JSON config file
- Type inference ensures `MigrationConfig` matches the Zod schema automatically
- Avoids manual type guards

### pino for Logging
- Structured JSON logging by default
- Optional pretty-print for local development
- Named child loggers per component

### Retry / Throttle Utility
- Generic exponential back-off with configurable max attempts, base delay, jitter
- Concurrency throttle helper to avoid hitting API rate limits
- No ADO-specific logic — reusable across any async operation

### Commander for CLI
- Well-established, minimal API surface
- Three initial commands: `migrate`, `validate`, `dry-run`
- All currently log "not implemented" — will be wired up in future issues

---

## Intended Migration Flow (Future)

```
1. User runs: ado-migrate migrate --config migration.json
2. CLI loads & validates config (Zod)
3. CLI creates AdoClient for source and target orgs
4. Appropriate migrators are selected based on config
5. Migrators call IAdoClient methods (read from source, write to target)
6. Results are collected and reported
7. On dry-run: no writes, only log what would happen
```

---

## Security Notes

- PATs (Personal Access Tokens) are read from environment variables, **not** from the config file
- No credentials are ever logged or committed
- The `ado-client` package is the only package allowed to make ADO API calls

---

## Future Work

- Implement real ADO API calls in `ado-client`
- Add work-item, attachment, and wiki migrators in `migrators`
- Add integration tests against a real ADO instance (behind feature flag)
- Add rate-limiting aware request queue to `ado-client`
- Publish packages to GitHub Packages registry
