import os from "node:os";
import path from "node:path";
import { generateTokenScript } from "./script-generator.js";
import { fallbackTableName } from "./table-location.js";
import type {
  CodexExporter,
  CustomUserConfig,
  DatabricksUserConfig,
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

const ALL_SIGNALS: Signal[] = ["logs", "metrics", "traces"];

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

function buildCodexHeaders(
  tableName: string,
  pat: string,
): Record<string, string> {
  return {
    Authorization: `Bearer ${pat}`,
    "content-type": "application/x-protobuf",
    "X-Databricks-UC-Table-Name": tableName,
  };
}

function buildCodexExporter(
  config: DatabricksUserConfig,
  signal: Signal,
): CodexExporter {
  if (!config.enabledSignals.includes(signal)) {
    return "none";
  }
  if (!config.pat) {
    throw new Error("pat is required for codex auth");
  }

  const tableName =
    config.tableSetup.resolvedTableNames?.[signal] ??
    fallbackTableName(config.tableSetup.location, signal);

  return {
    "otlp-http": {
      endpoint: `${config.workspaceUrl}/api/2.0/otel/v1/${SIGNAL_ENDPOINT_PATH[signal]}`,
      protocol: "binary",
      headers: buildCodexHeaders(tableName, config.pat),
    },
  };
}

function generateCodexConfig(config: DatabricksUserConfig): GeneratedConfig {
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

function generateClaudeCodeDatabricksConfig(
  config: DatabricksUserConfig,
): GeneratedConfig {
  const {
    workspaceUrl,
    authMethod,
    enabledSignals,
    tableSetup,
    contentOptions,
  } = config;

  const env: Record<string, string> = {};

  if (authMethod === "m2m") {
    env.DATABRICKS_HOST = workspaceUrl;
  }
  env.CLAUDE_CODE_ENABLE_TELEMETRY = "1";
  env.CLAUDE_CODE_ENHANCED_TELEMETRY_BETA = "1";

  for (const signal of ALL_SIGNALS) {
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

    const tableName =
      tableSetup.resolvedTableNames?.[signal] ??
      fallbackTableName(tableSetup.location, signal);
    env[`OTEL_EXPORTER_OTLP_${key}_HEADERS`] = buildHeaders(
      tableName,
      authMethod === "pat" ? config.pat : undefined,
    );
  }

  applyClaudeCodeSharedEnv(env, enabledSignals, contentOptions);

  const settingsAdditions: SettingsAdditions = { env };
  const tokenScript = generateTokenScript(config);

  if (tokenScript) {
    settingsAdditions.otelHeadersHelper = collapseTilde(tokenScript.filePath);
  }

  return { settingsAdditions, tokenScript };
}

function buildCustomHeaders(token: string): string {
  return [
    `Authorization=Bearer ${token}`,
    "content-type=application/x-protobuf",
  ].join(",");
}

function buildCustomCodexHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "content-type": "application/x-protobuf",
  };
}

function buildCustomCodexExporter(
  config: CustomUserConfig,
  signal: Signal,
): CodexExporter {
  if (!config.enabledSignals.includes(signal)) {
    return "none";
  }
  return {
    "otlp-http": {
      endpoint: `${config.endpoint}/v1/${SIGNAL_ENDPOINT_PATH[signal]}`,
      protocol: "binary",
      headers: buildCustomCodexHeaders(config.authorizationToken),
    },
  };
}

function generateCustomCodexConfig(config: CustomUserConfig): GeneratedConfig {
  return {
    settingsAdditions: { env: {} },
    codexConfig: {
      otel: {
        environment: "dev",
        log_user_prompt: config.contentOptions.logUserPrompts,
        exporter: buildCustomCodexExporter(config, "logs"),
        trace_exporter: buildCustomCodexExporter(config, "traces"),
        metrics_exporter: buildCustomCodexExporter(config, "metrics"),
      },
    },
    tokenScript: null,
  };
}

function applyClaudeCodeSharedEnv(
  env: Record<string, string>,
  enabledSignals: Signal[],
  contentOptions: {
    logUserPrompts: boolean;
    logToolDetails: boolean;
    logToolContent: boolean;
  },
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

function generateCustomClaudeCodeConfig(
  config: CustomUserConfig,
): GeneratedConfig {
  const { endpoint, authorizationToken, enabledSignals, contentOptions } =
    config;

  const env: Record<string, string> = {};
  env.CLAUDE_CODE_ENABLE_TELEMETRY = "1";
  env.CLAUDE_CODE_ENHANCED_TELEMETRY_BETA = "1";

  for (const signal of ALL_SIGNALS) {
    const key = SIGNAL_ENV_KEY[signal];
    const enabled = enabledSignals.includes(signal);

    if (!enabled) {
      env[`OTEL_${key}_EXPORTER`] = "none";
      continue;
    }

    env[`OTEL_${key}_EXPORTER`] = "otlp";
    env[`OTEL_EXPORTER_OTLP_${key}_PROTOCOL`] = "http/protobuf";
    env[`OTEL_EXPORTER_OTLP_${key}_ENDPOINT`] =
      `${endpoint}/v1/${SIGNAL_ENDPOINT_PATH[signal]}`;
    env[`OTEL_EXPORTER_OTLP_${key}_HEADERS`] =
      buildCustomHeaders(authorizationToken);
  }

  applyClaudeCodeSharedEnv(env, enabledSignals, contentOptions);

  return { settingsAdditions: { env }, tokenScript: null };
}

export function generateConfig(config: UserConfig): GeneratedConfig {
  if (config.destination === "custom") {
    return config.targetTool === "codex"
      ? generateCustomCodexConfig(config)
      : generateCustomClaudeCodeConfig(config);
  }

  return config.targetTool === "codex"
    ? generateCodexConfig(config)
    : generateClaudeCodeDatabricksConfig(config);
}
