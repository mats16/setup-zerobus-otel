export type TargetTool = "claude-code";

export type AuthMethod = "u2m" | "m2m" | "pat";

export type Signal = "logs" | "metrics" | "traces";

export type SettingsTarget = "global" | "project";

export interface TelemetryContentOptions {
  logUserPrompts: boolean;
  logToolDetails: boolean;
  logToolContent: boolean;
}

export interface UserConfig {
  targetTool: TargetTool;
  workspaceUrl: string;
  authMethod: AuthMethod;
  scriptLocation: string;
  profileName?: string;
  pat?: string;
  enabledSignals: Signal[];
  tablePrefix: string;
  settingsTarget: SettingsTarget;
  contentOptions: TelemetryContentOptions;
}

export interface GeneratedConfig {
  settingsAdditions: SettingsAdditions;
  tokenScript: GeneratedScript | null;
}

export interface SettingsAdditions {
  env: Record<string, string>;
  otelHeadersHelper?: string;
}

export interface GeneratedScript {
  filePath: string;
  content: string;
}
