import os from "node:os";
import path from "node:path";
import { generateTokenScript } from "./script-generator.js";
import { fallbackTableName } from "./table-location.js";
import type {
  CodexExporter,
  CodexOtlpHttpExporter,
  GeneratedConfig,
  SettingsAdditions,
  Signal,
  TelemetryContentOptions,
  UserConfig,
} from "./types.js";

const SIGNAL_ENV_KEY: Record<Signal, string> = {
  logs: "LOGS",
  metrics: "METRICS",
  traces: "TRACES",
};

const SIGNAL_ENDPOINT_PATH: Record<Signal, string> = {
  logs: "logs",
  metrics: "metrics",
  traces: "traces",
};

const ALL_SIGNALS: Signal[] = ["logs", "metrics", "traces"];

interface SignalEndpoint {
  url: string;
  headers: string;
  codexHeaders: Record<string, string>;
}

export function expandTilde(p: string): string {
  if (p.startsWith("~/")) {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}

function collapseTilde(p: string): string {
  const home = os.homedir();
  if (p.startsWith(home)) {
    return `~${p.slice(home.length)}`;
  }
  return p;
}

function buildHeaders(opts: { token?: string; tableName?: string }): string {
  const parts: string[] = [];
  if (opts.token) {
    parts.push(`Authorization=Bearer ${opts.token}`);
  }
  parts.push("content-type=application/x-protobuf");
  if (opts.tableName) {
    parts.push(`X-Databricks-UC-Table-Name=${opts.tableName}`);
  }
  return parts.join(",");
}

function buildCodexHeaders(opts: {
  token: string;
  tableName?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.token}`,
    "content-type": "application/x-protobuf",
  };
  if (opts.tableName) {
    headers["X-Databricks-UC-Table-Name"] = opts.tableName;
  }
  return headers;
}

function resolveSignalEndpoint(
  config: UserConfig,
  signal: Signal,
): SignalEndpoint {
  const path = SIGNAL_ENDPOINT_PATH[signal];

  if (config.destination === "custom") {
    const url = `${config.endpoint}/v1/${path}`;
    return {
      url,
      headers: buildHeaders({ token: config.authorizationToken }),
      codexHeaders: buildCodexHeaders({ token: config.authorizationToken }),
    };
  }

  const tableName =
    config.tableSetup.resolvedTableNames?.[signal] ??
    fallbackTableName(config.tableSetup.location, signal);
  const url = `${config.workspaceUrl}/api/2.0/otel/v1/${path}`;
  const codexToken = config.pat ?? "";
  return {
    url,
    headers: buildHeaders({
      tableName,
      token: config.authMethod === "pat" ? config.pat : undefined,
    }),
    codexHeaders: buildCodexHeaders({ token: codexToken, tableName }),
  };
}

function applySignalEnv(
  env: Record<string, string>,
  enabledSignals: Signal[],
  resolveSignal: (signal: Signal) => SignalEndpoint,
): void {
  for (const signal of ALL_SIGNALS) {
    const key = SIGNAL_ENV_KEY[signal];
    if (!enabledSignals.includes(signal)) {
      env[`OTEL_${key}_EXPORTER`] = "none";
      continue;
    }
    const { url, headers } = resolveSignal(signal);
    env[`OTEL_${key}_EXPORTER`] = "otlp";
    env[`OTEL_EXPORTER_OTLP_${key}_PROTOCOL`] = "http/protobuf";
    env[`OTEL_EXPORTER_OTLP_${key}_ENDPOINT`] = url;
    env[`OTEL_EXPORTER_OTLP_${key}_HEADERS`] = headers;
  }
}

function applyClaudeCodeSharedEnv(
  env: Record<string, string>,
  enabledSignals: Signal[],
  contentOptions: TelemetryContentOptions,
): void {
  if (enabledSignals.includes("metrics")) {
    env.OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE = "delta";
    env.OTEL_METRIC_EXPORT_INTERVAL = "10000";
  }
  if (enabledSignals.includes("logs")) {
    env.OTEL_LOGS_EXPORT_INTERVAL = "5000";
  }
  if (enabledSignals.includes("traces")) {
    env.OTEL_TRACES_EXPORT_INTERVAL = "1000";
  }

  env.OTEL_LOG_USER_PROMPTS = contentOptions.logUserPrompts ? "1" : "0";
  env.OTEL_LOG_TOOL_DETAILS = contentOptions.logToolDetails ? "1" : "0";
  env.OTEL_LOG_TOOL_CONTENT = contentOptions.logToolContent ? "1" : "0";
}

function generateClaudeCodeConfig(config: UserConfig): GeneratedConfig {
  const env: Record<string, string> = {};

  if (config.destination === "databricks" && config.authMethod === "m2m") {
    env.DATABRICKS_HOST = config.workspaceUrl;
  }
  env.CLAUDE_CODE_ENABLE_TELEMETRY = "1";
  env.CLAUDE_CODE_ENHANCED_TELEMETRY_BETA = "1";

  applySignalEnv(env, config.enabledSignals, (signal) =>
    resolveSignalEndpoint(config, signal),
  );
  applyClaudeCodeSharedEnv(env, config.enabledSignals, config.contentOptions);

  const settingsAdditions: SettingsAdditions = { env };
  const tokenScript =
    config.destination === "databricks" ? generateTokenScript(config) : null;

  if (tokenScript) {
    settingsAdditions.otelHeadersHelper = collapseTilde(tokenScript.filePath);
  }

  return { settingsAdditions, tokenScript };
}

function buildCodexExporter(config: UserConfig, signal: Signal): CodexExporter {
  if (!config.enabledSignals.includes(signal)) {
    return "none";
  }
  if (config.destination === "databricks" && !config.pat) {
    throw new Error("pat is required for codex auth");
  }

  const { url, codexHeaders } = resolveSignalEndpoint(config, signal);
  const otlpHttp: CodexOtlpHttpExporter["otlp-http"] = {
    endpoint: url,
    protocol: "binary",
    headers: codexHeaders,
  };
  return { "otlp-http": otlpHttp };
}

function generateCodexConfig(config: UserConfig): GeneratedConfig {
  return {
    settingsAdditions: { env: {} },
    codexConfig: {
      otel: {
        environment: "dev",
        log_user_prompt: config.contentOptions.logUserPrompts,
        exporter: buildCodexExporter(config, "logs"),
        trace_exporter: buildCodexExporter(config, "traces"),
        metrics_exporter: buildCodexExporter(config, "metrics"),
      },
    },
    tokenScript: null,
  };
}

export function generateConfig(config: UserConfig): GeneratedConfig {
  return config.targetTool === "codex"
    ? generateCodexConfig(config)
    : generateClaudeCodeConfig(config);
}
