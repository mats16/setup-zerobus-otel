# setup-zerobus-otel

Interactive setup CLI for sending OpenTelemetry output from Claude Code or Codex to the Databricks Zerobus OTEL endpoint.

This package is designed to be run directly with `npx`, `pnpx`, or `bunx`. A global install is not required.

Japanese README: [README_ja.md](./README_ja.md)

## Quick Start

```bash
npx setup-zerobus-otel
```

With pnpm or Bun:

```bash
pnpx setup-zerobus-otel
bunx setup-zerobus-otel
```

The CLI walks you through your Databricks workspace, authentication method, enabled telemetry signals, destination tables, and the Claude Code or Codex settings scope. Before writing anything, it shows a preview and asks for confirmation.

## What This Does

- Generates OTEL configuration for Claude Code or Codex
- Configures Logs / Metrics / Traces to send to the Databricks Zerobus OTEL endpoint
- Lets you select existing Unity Catalog tables or create new destination tables
- Supports U2M / M2M / PAT authentication for Claude Code
- Supports direct PAT authentication for Codex
- Preserves existing settings and updates only the relevant OTEL keys

## Requirements

- Node.js 18 or later
- A Databricks workspace
- Permissions for the target Unity Catalog catalog / schema / tables
- If creating tables from the CLI: permissions to create or get the schema, trace location, and MLflow Experiment through Databricks APIs

For Claude Code with U2M authentication:

- Databricks CLI
- A logged-in Databricks CLI profile, or the ability to log in during setup with `databricks auth login --profile <profile>`

For Claude Code with M2M authentication:

- `DATABRICKS_CLIENT_ID`
- `DATABRICKS_CLIENT_SECRET`

## Supported Targets

### Claude Code

For Claude Code, this CLI adds `env` and, when needed, `otelHeadersHelper` to the Claude Code settings file.

You can choose the target settings scope during setup.

- Global: `~/.claude/settings.json`
- Project: `.claude/settings.json`
- Local: `.claude/settings.local.json`

Existing settings such as `hooks`, `permissions`, and `mcpServers` are preserved. The CLI updates only the OTEL-related `env` and `otelHeadersHelper` keys.

Supported authentication methods:

- OAuth for users (U2M): dynamically gets tokens from a Databricks CLI profile
- OAuth for service principals (M2M): dynamically gets tokens from `DATABRICKS_CLIENT_ID` / `DATABRICKS_CLIENT_SECRET`
- Personal Access Token (PAT): writes the token directly into OTEL headers

For U2M and M2M, the CLI generates a token helper script and configures it as Claude Code's `otelHeadersHelper`.

### Codex

For Codex, this CLI adds an `[otel]` configuration to `config.toml`.

You can choose the target settings scope during setup.

- Global: `~/.codex/config.toml`
- Project: `.codex/config.toml`

Codex currently supports direct PAT authentication only.

## Databricks Tables

The CLI asks for a Unity Catalog `catalog.schema` and a table prefix to use as the Databricks OTEL destination.

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

For Codex, you can choose whether to include raw user prompts in OTEL logs.

Telemetry can contain sensitive information. Enable only the fields that match your organization's policy.

## Usage Examples

Run the CLI:

```bash
npx setup-zerobus-otel
```

Force the latest published package:

```bash
npx setup-zerobus-otel@latest
```

pnpm:

```bash
pnpx setup-zerobus-otel
```

Bun:

```bash
bunx setup-zerobus-otel
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
