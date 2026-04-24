import os from "node:os";
import path from "node:path";
import { generateTokenScript } from "./script-generator.js";
import type {
  GeneratedConfig,
  SettingsAdditions,
  Signal,
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

const SIGNAL_TABLE_SUFFIX: Record<Signal, string> = {
  logs: "otel_logs",
  metrics: "otel_metrics",
  traces: "otel_spans",
};

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

function buildHeaders(tableName: string, pat?: string): string {
  const parts: string[] = [];
  if (pat) {
    parts.push(`Authorization=Bearer ${pat}`);
  }
  parts.push("content-type=application/x-protobuf");
  parts.push(`X-Databricks-UC-Table-Name=${tableName}`);
  return parts.join(",");
}

export function generateConfig(config: UserConfig): GeneratedConfig {
  const {
    workspaceUrl,
    authMethod,
    enabledSignals,
    tablePrefix,
    contentOptions,
  } = config;

  const env: Record<string, string> = {};

  if (authMethod === "m2m") {
    env.DATABRICKS_HOST = workspaceUrl;
  }
  env.CLAUDE_CODE_ENABLE_TELEMETRY = "1";
  env.CLAUDE_CODE_ENHANCED_TELEMETRY_BETA = "1";

  const allSignals: Signal[] = ["logs", "metrics", "traces"];

  for (const signal of allSignals) {
    const key = SIGNAL_ENV_KEY[signal];
    const enabled = enabledSignals.includes(signal);

    if (!enabled) {
      env[`OTEL_${key}_EXPORTER`] = "none";
      continue;
    }

    env[`OTEL_${key}_EXPORTER`] = "otlp";
    env[`OTEL_EXPORTER_OTLP_${key}_PROTOCOL`] = "http/protobuf";
    env[`OTEL_EXPORTER_OTLP_${key}_ENDPOINT`] =
      `${workspaceUrl}/api/2.0/otel/v1/${SIGNAL_ENDPOINT_PATH[signal]}`;

    const tableName = `${tablePrefix}${SIGNAL_TABLE_SUFFIX[signal]}`;
    env[`OTEL_EXPORTER_OTLP_${key}_HEADERS`] = buildHeaders(
      tableName,
      authMethod === "pat" ? config.pat : undefined,
    );
  }

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

  const settingsAdditions: SettingsAdditions = { env };
  const tokenScript = generateTokenScript(config);

  if (tokenScript) {
    settingsAdditions.otelHeadersHelper = collapseTilde(tokenScript.filePath);
  }

  return { settingsAdditions, tokenScript };
}
