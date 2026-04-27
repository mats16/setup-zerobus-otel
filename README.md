# setup-agent-otel

Interactive setup CLI for sending OpenTelemetry output from Claude Code or Codex to Databricks Zerobus Ingest, or to any custom OTLP/HTTP backend.

This package is designed to be run directly with `npx`, `pnpx`, or `bunx`. A global install is not required.

Japanese README: [README_ja.md](./README_ja.md)

## Quick Start

```bash
npx setup-agent-otel
```

With pnpm or Bun:

```bash
pnpx setup-agent-otel
bunx setup-agent-otel
```

The CLI walks you through the destination, authentication, enabled telemetry signals, and the Claude Code or Codex settings scope. Before writing anything, it shows a preview and asks for confirmation.

## What This Does

- Generates OTEL configuration for Claude Code or Codex
- Sends Logs / Metrics / Traces to one of two destinations:
  - **Databricks (Zerobus Ingest)**: full Unity Catalog table setup with optional MLflow Experiment linking
  - **Custom (OTLP/HTTP)**: any OTLP/HTTP endpoint with a static authorization token
- Supports U2M / M2M / PAT authentication for Claude Code with Databricks
- Supports direct PAT authentication for Codex with Databricks
- Preserves existing settings and updates only the relevant OTEL keys

## Destinations

### Databricks (Zerobus Ingest)

The full Databricks flow. The CLI asks for your workspace URL, authentication method, Unity Catalog `catalog.schema`, table prefix, and optionally creates the schema, trace location, and MLflow Experiment via Databricks APIs.

### Custom (OTLP/HTTP)

A minimal flow for any OTLP/HTTP-compatible backend. The CLI asks for:

- An OTLP base URL. The default is `https://cloud.langfuse.com/api/public/otel` (Langfuse Cloud EU); replace it with any backend you control.
- An authentication scheme — `Bearer` (static token) or `Basic` (the CLI base64-encodes a `username:password` you enter).
- A path per enabled signal, defaulted to the standard `/v1/logs`, `/v1/metrics`, `/v1/traces`. Override per-signal as needed.

The resulting endpoint is `<base><path>` per signal (e.g. `https://cloud.langfuse.com/api/public/otel/v1/traces`). No Databricks-specific headers, schemas, tables, or MLflow Experiments are created.

## Requirements

- Node.js 18 or later

For the **Databricks** destination:

- A Databricks workspace
- Permissions for the target Unity Catalog catalog / schema / tables
- If creating tables from the CLI: permissions to create or get the schema, trace location, and MLflow Experiment through Databricks APIs

For Claude Code with U2M authentication:

- Databricks CLI
- A logged-in Databricks CLI profile, or the ability to log in during setup with `databricks auth login --profile <profile>`

For Claude Code with M2M authentication:

- `DATABRICKS_CLIENT_ID`
- `DATABRICKS_CLIENT_SECRET`

For the **Custom** destination:

- An OTLP/HTTP endpoint and credentials for either Bearer or Basic auth

## Supported Targets

### Claude Code

For Claude Code, this CLI adds `env` and, when needed, `otelHeadersHelper` to the Claude Code settings file.

The generated `env` block follows Claude Code's monitoring configuration: it enables telemetry with `CLAUDE_CODE_ENABLE_TELEMETRY=1`, writes OTEL exporter / protocol / endpoint / header variables per selected signal, and enables `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1` only when Traces are selected.

You can choose the target settings scope during setup.

- Global: `~/.claude/settings.json`
- Project: `.claude/settings.json`
- Local: `.claude/settings.local.json`

Existing settings such as `hooks`, `permissions`, and `mcpServers` are preserved. The CLI updates only the OTEL-related `env` and `otelHeadersHelper` keys.

Authentication methods (Databricks destination only):

- OAuth for users (U2M): dynamically gets tokens from a Databricks CLI profile
- OAuth for service principals (M2M): dynamically gets tokens from `DATABRICKS_CLIENT_ID` / `DATABRICKS_CLIENT_SECRET`
- Personal Access Token (PAT): writes the token directly into OTEL headers

For U2M and M2M, the CLI generates a token helper script and configures it as Claude Code's `otelHeadersHelper`.

The Custom destination always uses the static Bearer or Basic credential you provide; no helper script is generated.

### Codex

For Codex, this CLI adds an `[otel]` configuration to `config.toml`.

You can choose the target settings scope during setup.

- Global: `~/.codex/config.toml`
- Project: `.codex/config.toml`

Codex with the Databricks destination supports direct PAT authentication only. With the Custom destination, Codex uses the bearer token you provide.

## Databricks Tables

When using the Databricks destination, the CLI asks for a Unity Catalog `catalog.schema` and a table prefix.

Example:

```text
catalog.schema: main.default
table prefix: claude
```

By default, this maps to tables like:

- Logs: `main.default.claude_otel_logs`
- Metrics: `main.default.claude_otel_metrics`
- Traces: `main.default.claude_otel_spans`

You can choose how tables are prepared:

- Create new tables: the CLI uses Databricks APIs to create or get the schema, trace location, and tables
- Use existing tables: the CLI configures OTEL headers assuming the tables already exist

When creating new tables, you can optionally link the trace location to an MLflow Experiment.

## Telemetry Content

You can choose which signals to enable:

- Logs
- Metrics
- Traces (Spans)

For Claude Code, you can also choose which content is included in telemetry:

- User prompts
- Tool execution details
- Tool input/output content

Tool input/output content is emitted through trace spans, so the CLI only enables that option when Traces are selected.

For Codex, you can choose whether to include raw user prompts in OTEL logs.

Telemetry can contain sensitive information. Enable only the fields that match your organization's policy.

## Usage Examples

Run the CLI:

```bash
npx setup-agent-otel
```

Force the latest published package:

```bash
npx setup-agent-otel@latest
```

pnpm:

```bash
pnpx setup-agent-otel
```

Bun:

```bash
bunx setup-agent-otel
```

## Development

If you are developing this repository locally:

```bash
bun install
bun run build
bun run typecheck
```

Run the local CLI:

```bash
node dist/index.js
npx ./
```

## License

Apache-2.0
