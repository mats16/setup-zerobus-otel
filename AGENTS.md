# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive CLI tool (`npx setup-agent-otel`) that configures OpenTelemetry sending from Claude Code or Codex to Databricks Zerobus Ingest, or to any custom OTLP/HTTP backend. Based on the reference implementation at https://github.com/akuwano/databricks-cc-otel.

## Commands

```bash
bun install          # Install dependencies
bun run build        # Build with tsup → dist/index.js
bun run dev          # Build in watch mode
bun run typecheck    # TypeScript type checking (tsc --noEmit)
node dist/index.js   # Run the built CLI locally
npx ./               # Test as if installed via npx
```

## Architecture

The CLI follows a pipeline: **prompts → config generation → file writing**.

- `src/index.ts` — Entry point. Orchestrates the flow: banner → collect input → generate config → preview → confirm → apply → summary.
- `src/prompts.ts` — All interactive prompts via `@inquirer/prompts`. Exports `collectUserConfig()` which returns a `UserConfig`.
- `src/config-generator.ts` — Pure logic. Transforms `UserConfig` into `GeneratedConfig` (settings.json env block + optional otelHeadersHelper path). Calls into `script-generator` for token scripts.
- `src/script-generator.ts` — Generates Node.js scripts for dynamic token retrieval (`gen_otel_headers_u2m.js` / `gen_otel_headers_m2m.js`). Returns `null` for PAT auth.
- `src/file-writer.ts` — Reads existing `settings.json`, deep-merges new config (preserving hooks, permissions, mcpServers, etc.), writes files, chmod +x on scripts.
- `src/types.ts` — Shared type definitions. `UserConfig` is the central data model passed between modules.

### Key Design Decisions

- **Package manager**: bun. **Runtime**: Node.js (`#!/usr/bin/env node` shebang via tsup banner) for compatibility with npx/pnpx/bunx.
- **Deep merge, not overwrite**: `file-writer.ts` merges into existing settings.json. Only `env` and `otelHeadersHelper` keys are touched.
- **Tilde handling**: Script paths use `os.homedir()` expansion for writing files, but `~/...` form in settings.json (Claude Code resolves `~` itself).
- **Destinations**: `databricks` (Zerobus Ingest, full UC tables + auth methods + MLflow Experiment) and `custom` (any OTLP/HTTP endpoint, Bearer or Basic auth, per-signal paths defaulted to `/v1/{logs,metrics,traces}`; default base URL is `https://cloud.langfuse.com/api/public/otel`). `UserConfig` is a discriminated union on `destination`.
- **Auth methods (Databricks only)**: `u2m` (Databricks CLI), `m2m` (Service Principal OAuth), `pat` (static token in headers). PAT embeds token directly in OTEL headers; u2m/m2m use `otelHeadersHelper`.
- **Custom auth schemes**: `bearer` (token sent verbatim) and `basic` (CLI base64-encodes the entered `username:password` before storing).
- **Signal mapping**: `traces` signal maps to OTEL env key `TRACES`, endpoint path `traces`, but table suffix `otel_spans` (Databricks). For custom, the URL is `<base><signalPath>` where `signalPath` defaults to `/v1/{signal}` and is user-overridable.

## Language

User-facing messages (prompts, banner, summaries) are in Japanese.
