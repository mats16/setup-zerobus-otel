export type TargetTool = "claude-code" | "codex";

export type AuthMethod = "u2m" | "m2m" | "pat";

export type Signal = "logs" | "metrics" | "traces";

export type SettingsTarget = "global" | "project" | "local";

export type TableSetupMode = "create" | "existing";

export type ExperimentRetryAction = "retry" | "skip";

export interface TelemetryContentOptions {
  logUserPrompts: boolean;
  logToolDetails: boolean;
  logToolContent: boolean;
}

export interface UcTablePrefix {
  catalogName: string;
  schemaName: string;
  tablePrefix: string;
}

export type SignalTableNames = Partial<Record<Signal, string>>;

export interface TableSetupConfig {
  mode: TableSetupMode;
  location: UcTablePrefix;
  resolvedTableNames?: SignalTableNames;
  experimentName?: string;
  experimentId?: string;
}

export interface UserConfig {
  targetTool: TargetTool;
  workspaceUrl: string;
  authMethod: AuthMethod;
  scriptLocation: string;
  profileName?: string;
  pat?: string;
  enabledSignals: Signal[];
  tableSetup: TableSetupConfig;
  settingsTarget: SettingsTarget;
  contentOptions: TelemetryContentOptions;
}

export interface GeneratedConfig {
  settingsAdditions: SettingsAdditions;
  codexConfig?: CodexConfigAdditions;
  tokenScript: GeneratedScript | null;
}

export interface SettingsAdditions {
  env: Record<string, string>;
  otelHeadersHelper?: string;
}

export type CodexExporter = "none" | CodexOtlpHttpExporter;

export interface CodexOtlpHttpExporter {
  "otlp-http": {
    endpoint: string;
    protocol: "binary";
    headers: Record<string, string>;
  };
}

export interface CodexOtelConfig {
  environment: string;
  log_user_prompt: boolean;
  exporter: CodexExporter;
  trace_exporter: CodexExporter;
  metrics_exporter: CodexExporter;
}

export interface CodexConfigAdditions {
  otel: CodexOtelConfig;
}

export interface GeneratedScript {
  filePath: string;
  content: string;
}
