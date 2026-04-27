# setup-agent-otel

Claude Code / Codex の OpenTelemetry 出力を、Databricks Zerobus Ingest または任意の OTLP/HTTP エンドポイントに送るための対話式セットアップ CLI です。

`npx` / `pnpx` / `bunx` でその場で実行する利用を前提にしています。グローバルインストールは不要です。

English README: [README.md](./README.md)

## Quick Start

```bash
npx setup-agent-otel
```

pnpm または Bun を使う場合:

```bash
pnpx setup-agent-otel
bunx setup-agent-otel
```

CLI が質問に沿って、送信先、認証方式、送信するシグナル、Claude Code / Codex の設定スコープを確認します。最後に変更内容をプレビューし、確認後に設定ファイルへ反映します。

## What This Does

- Claude Code または Codex の OTEL 設定を生成します
- 以下 2 種類の送信先に対応します:
  - **Databricks (Zerobus Ingest)**: Unity Catalog テーブル一式を扱い、必要なら MLflow Experiment への紐づけまで自動化します
  - **Custom (OTLP/HTTP)**: 任意の OTLP/HTTP エンドポイントへ、静的な authorization token で送信します
- Claude Code + Databricks では U2M / M2M / PAT 認証に対応します
- Codex + Databricks では PAT 認証による直接設定に対応します
- 既存の設定ファイルを壊さないように、対象キーだけをマージまたは更新します

## 送信先

### Databricks (Zerobus Ingest)

従来の Databricks 連携フローです。Workspace URL、認証方式、Unity Catalog の `catalog.schema`、table prefix を指定し、必要に応じて schema / trace location / MLflow Experiment を Databricks API で作成または取得します。

### Custom (OTLP/HTTP)

任意の OTLP/HTTP backend に送る最小フローです。CLI で確認する項目:

- OTLP の base URL。デフォルトは `https://cloud.langfuse.com/api/public/otel` (Langfuse Cloud EU)。任意の backend に書き換え可能です。
- 認証スキーム — `Bearer` (静的トークン) または `Basic` (`username:password` を入力すると CLI が base64 エンコードします)
- 有効化したシグナルごとのパス。デフォルトは標準の `/v1/logs`、`/v1/metrics`、`/v1/traces` で、各々上書き可能です。

最終的なエンドポイントは `<base><path>` (例: `https://cloud.langfuse.com/api/public/otel/v1/traces`)。Databricks 固有のヘッダーやテーブル、MLflow Experiment などは作成されません。

## Requirements

- Node.js 18 以上

**Databricks** 送信先を使う場合:

- Databricks workspace
- Unity Catalog の対象 catalog / schema / table への権限
- テーブルを CLI から作成する場合は、Databricks API で schema / trace location / MLflow Experiment を作成または取得できる権限

Claude Code で U2M 認証を使う場合:

- Databricks CLI
- `databricks auth login --profile <profile>` でログイン済み、または CLI 実行中にログイン可能な状態

Claude Code で M2M 認証を使う場合:

- `DATABRICKS_CLIENT_ID`
- `DATABRICKS_CLIENT_SECRET`

**Custom** 送信先を使う場合:

- OTLP/HTTP エンドポイントと、Bearer または Basic 認証の credential

## Supported Targets

### Claude Code

Claude Code の設定ファイルに `env` と、必要に応じて `otelHeadersHelper` を追加します。

生成される `env` は Claude Code の monitoring 設定に沿っています。`CLAUDE_CODE_ENABLE_TELEMETRY=1` で telemetry を有効化し、選択したシグナルごとに OTEL exporter / protocol / endpoint / header を設定します。`CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1` は Traces を選んだ場合だけ設定します。

書き込み先は実行時に選択できます。

- Global: `~/.claude/settings.json`
- Project: `.claude/settings.json`
- Local: `.claude/settings.local.json`

既存の `hooks`、`permissions`、`mcpServers` などは保持されます。CLI が更新するのは OTEL に必要な `env` と `otelHeadersHelper` です。

対応する認証方式 (Databricks 送信先のみ):

- OAuth for users (U2M): Databricks CLI profile から動的に token を取得
- OAuth for service principals (M2M): `DATABRICKS_CLIENT_ID` / `DATABRICKS_CLIENT_SECRET` から動的に token を取得
- Personal Access Token (PAT): OTEL headers に token を直接設定

U2M / M2M では token helper script を生成し、Claude Code の `otelHeadersHelper` に設定します。

Custom 送信先では、入力された静的な Bearer または Basic credential をそのまま使用します。helper script は生成されません。

### Codex

Codex の `config.toml` に `[otel]` 設定を追加します。

書き込み先は実行時に選択できます。

- Global: `~/.codex/config.toml`
- Project: `.codex/config.toml`

Codex + Databricks 送信先は PAT 認証のみ対応しています。Custom 送信先では入力された bearer token を使います。

## Databricks Tables

Databricks 送信先を選んだ場合、Unity Catalog の `catalog.schema` と table prefix を指定します。

例:

```text
catalog.schema: main.default
table prefix: claude
```

この場合、既定では次のようなテーブル名が使われます。

- Logs: `main.default.claude_otel_logs`
- Metrics: `main.default.claude_otel_metrics`
- Traces: `main.default.claude_otel_spans`

テーブル準備方法は実行時に選べます。

- 新規作成: CLI が Databricks API を使って schema / trace location / table を作成または取得します
- 既存利用: 既存テーブル名を前提に OTEL headers を設定します

新規作成を選んだ場合、任意で MLflow Experiment との trace location 紐づけも行えます。

## Telemetry Content

CLI では送信するシグナルを選択できます。

- Logs
- Metrics
- Traces (Spans)

Claude Code では、テレメトリに含める内容も選択できます。

- ユーザープロンプト
- ツール実行詳細
- ツール入出力内容

ツール入出力内容は trace span 経由で出力されるため、CLI は Traces が選択されている場合だけこの項目を有効化します。

Codex では、OTEL logs にユーザープロンプト本文を含めるかを選択できます。

送信内容には機密情報が含まれる可能性があります。組織のポリシーに合わせて、必要な項目だけを有効化してください。

## Usage Examples

標準の実行:

```bash
npx setup-agent-otel
```

常に最新パッケージを取得して実行:

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

このリポジトリを clone して開発する場合:

```bash
bun install
bun run build
bun run typecheck
```

ローカルで CLI を確認する場合:

```bash
node dist/index.js
npx ./
```

## License

Apache-2.0
