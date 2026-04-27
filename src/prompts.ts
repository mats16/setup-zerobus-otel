import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { checkbox, confirm, input, password, select } from "@inquirer/prompts";
import { type Locale, setLocale, t } from "./i18n.js";
import type {
  AuthMethod,
  CustomAuthScheme,
  CustomSignalPaths,
  Destination,
  ExperimentRetryAction,
  SettingsTarget,
  Signal,
  TableSetupConfig,
  TableSetupMode,
  TargetTool,
  TelemetryContentOptions,
  UserConfig,
} from "./types.js";

const LANGFUSE_DEFAULT_ENDPOINT = "https://cloud.langfuse.com/api/public/otel";

const SIGNAL_DEFAULT_PATH: Record<Signal, string> = {
  logs: "/v1/logs",
  metrics: "/v1/metrics",
  traces: "/v1/traces",
};

export async function promptLocale(): Promise<Locale> {
  return select({
    message: "Which language would you like to use? / どの言語を使用しますか?",
    choices: [
      { name: "English", value: "en" as const },
      { name: "日本語", value: "ja" as const },
    ],
  });
}

async function promptTargetTool(): Promise<TargetTool> {
  return select({
    message: t().selectTargetTool,
    choices: [
      {
        name: t().targetClaudeCode,
        value: "claude-code" as const,
      },
      {
        name: t().targetCodex,
        value: "codex" as const,
      },
    ],
  });
}

async function promptDestination(): Promise<Destination> {
  return select({
    message: t().selectDestination,
    choices: [
      {
        name: t().destinationDatabricks,
        value: "databricks" as const,
      },
      {
        name: t().destinationCustom,
        value: "custom" as const,
      },
    ],
  });
}

async function promptCustomEndpoint(): Promise<string> {
  const url = await input({
    message: t().customEndpointPrompt,
    default: LANGFUSE_DEFAULT_ENDPOINT,
    validate: (value) => {
      const normalized = normalizeUrl(value);
      try {
        const parsed = new URL(normalized);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
          return t().enterValidUrl;
        }
        if (!parsed.hostname) {
          return t().enterValidHostname;
        }
      } catch {
        return t().enterValidUrl;
      }
      return true;
    },
  });
  return normalizeUrl(url);
}

async function promptCustomAuthScheme(): Promise<CustomAuthScheme> {
  return select({
    message: t().selectCustomAuthScheme,
    choices: [
      { name: t().customAuthBearer, value: "bearer" as const },
      { name: t().customAuthBasic, value: "basic" as const },
    ],
  });
}

async function promptCustomCredential(
  scheme: CustomAuthScheme,
): Promise<string> {
  const message =
    scheme === "basic"
      ? t().customBasicCredentialPrompt
      : t().customBearerTokenPrompt;
  const raw = await password({
    message,
    validate: (value) => {
      if (!value) return t().tokenRequired;
      return true;
    },
  });
  return scheme === "basic" ? Buffer.from(raw, "utf8").toString("base64") : raw;
}

async function promptCustomSignalPaths(
  enabledSignals: Signal[],
): Promise<CustomSignalPaths> {
  const paths: CustomSignalPaths = {};
  for (const signal of enabledSignals) {
    const path = await input({
      message: t().customSignalPathPrompt(signal),
      default: SIGNAL_DEFAULT_PATH[signal],
      validate: (value) => {
        const trimmed = value.trim();
        if (!trimmed.startsWith("/")) return t().customSignalPathValidation;
        return true;
      },
    });
    paths[signal] = path.trim();
  }
  return paths;
}

function normalizeUrl(value: string): string {
  let url = value.trim();
  if (!url.startsWith("https://") && !url.startsWith("http://")) {
    url = `https://${url}`;
  }
  return url.replace(/\/+$/, "");
}

async function promptWorkspaceUrl(): Promise<string> {
  const url = await input({
    message: "What is your Databricks workspace URL?",
    validate: (value) => {
      const normalized = normalizeUrl(value);
      try {
        const parsed = new URL(normalized);
        if (parsed.protocol !== "https:") {
          return t().urlMustBeHttps;
        }
        if (!parsed.hostname.includes(".")) {
          return t().enterValidHostname;
        }
      } catch {
        return t().enterValidUrl;
      }
      return true;
    },
  });
  return normalizeUrl(url);
}

async function promptAuthMethod(): Promise<AuthMethod> {
  return select({
    message: t().selectAuthMethod,
    choices: [
      {
        name: t().authU2m,
        value: "u2m" as const,
      },
      {
        name: t().authM2m,
        value: "m2m" as const,
      },
      {
        name: t().authPat,
        value: "pat" as const,
      },
    ],
  });
}

interface ProfileInfo {
  host: string;
  authType?: string;
}

async function parseDatabricksCfg(): Promise<Map<string, ProfileInfo>> {
  const cfgPath = path.join(os.homedir(), ".databrickscfg");
  const profiles = new Map<string, ProfileInfo>();
  let content: string;
  try {
    content = await fs.readFile(cfgPath, "utf-8");
  } catch {
    return profiles;
  }
  let currentProfile: string | null = null;
  const sections = new Map<string, Record<string, string>>();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(";"))
      continue;
    const sectionMatch = trimmed.match(/^\[(.+)]$/);
    if (sectionMatch?.[1]) {
      currentProfile = sectionMatch[1];
      if (!sections.has(currentProfile)) sections.set(currentProfile, {});
      continue;
    }
    if (currentProfile) {
      const kvMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
      if (kvMatch?.[1] && kvMatch[2]) {
        const section = sections.get(currentProfile);
        if (section) {
          section[kvMatch[1]] = kvMatch[2].trim();
        }
      }
    }
  }
  for (const [name, kv] of sections) {
    const authType = kv.auth_type;
    if (authType && authType !== "databricks-cli") continue;
    const rawHost = kv.host;
    if (!rawHost) continue;
    const host = normalizeUrl(rawHost);
    profiles.set(name, { host, authType });
  }
  return profiles;
}

async function promptProfileName(
  profiles: Map<string, ProfileInfo>,
): Promise<string> {
  if (profiles.size > 0) {
    return select({
      message: t().selectProfile,
      choices: Array.from(profiles, ([name, info]) => ({
        name: `${name} (${info.host})`,
        value: name,
      })),
    });
  }
  console.log(t().noProfileFound);
  return input({
    message: t().enterProfileName,
    default: "DEFAULT",
    validate: (value) => {
      if (!value.trim()) return t().enterProfileNameValidation;
      return true;
    },
  });
}

async function resolveWorkspaceUrlFromProfile(
  profileName: string,
  profiles: Map<string, ProfileInfo>,
): Promise<string> {
  const info = profiles.get(profileName);
  if (info) {
    console.log(t().profileResolved(profileName, info.host));
    return info.host;
  }
  console.log(t().profileNotFound(profileName));
  console.log(t().enterWorkspaceUrlManually);
  return promptWorkspaceUrl();
}

async function promptScriptLocation(): Promise<string> {
  return input({
    message: t().scriptLocationPrompt,
    default: "~/.local/bin",
  });
}

async function promptPat(): Promise<string> {
  return password({
    message: t().enterToken,
    validate: (value) => {
      if (!value) return t().tokenRequired;
      return true;
    },
  });
}

async function promptSignals(): Promise<Signal[]> {
  const signals = await checkbox({
    message: t().selectSignals,
    choices: [
      { name: "Logs", value: "logs" as const, checked: true },
      { name: "Metrics", value: "metrics" as const, checked: true },
      { name: "Traces (Spans)", value: "traces" as const, checked: true },
    ],
    validate: (value) => {
      if (value.length === 0) return t().selectAtLeastOne;
      return true;
    },
  });
  return signals;
}

function parseUcSchema(
  value: string,
): { catalogName: string; schemaName: string } | null {
  const parts = value
    .trim()
    .split(".")
    .map((part) => part.trim());
  if (parts.length !== 2 || parts.some((part) => part.length === 0)) {
    return null;
  }
  const [catalogName, schemaName] = parts;
  if (!catalogName || !schemaName) {
    return null;
  }
  return { catalogName, schemaName };
}

async function promptTableSetupMode(): Promise<TableSetupMode> {
  return select({
    message: t().selectTableSetupMode,
    choices: [
      {
        name: t().tableSetupCreate,
        value: "create" as const,
      },
      {
        name: t().tableSetupExisting,
        value: "existing" as const,
      },
    ],
  });
}

async function promptTableSetup(
  targetTool: TargetTool,
): Promise<TableSetupConfig> {
  const mode = await promptTableSetupMode();
  const schema = await input({
    message: t().tableSchemaPrompt,
    default: "main.default",
    validate: (value) => {
      if (!parseUcSchema(value)) {
        return t().tableSchemaValidation;
      }
      return true;
    },
  });
  const parsedSchema = parseUcSchema(schema);
  if (!parsedSchema) {
    throw new Error(t().tableSchemaValidation);
  }

  const rawTablePrefix = await input({
    message: t().tablePrefixPrompt,
    default: targetTool === "codex" ? "codex" : "claude",
    validate: (value) => {
      const trimmed = value.trim();
      if (!trimmed) return t().tablePrefixValidation;
      if (trimmed.includes(".")) return t().tablePrefixValidation;
      if (trimmed.endsWith("_")) return t().tablePrefixValidation;
      return true;
    },
  });
  const tablePrefix = rawTablePrefix.trim();
  const tableSetup: TableSetupConfig = {
    mode,
    location: {
      catalogName: parsedSchema.catalogName,
      schemaName: parsedSchema.schemaName,
      tablePrefix,
    },
  };

  if (mode === "create") {
    const experimentName = await promptExperimentName();
    if (experimentName.trim()) {
      tableSetup.experimentName = experimentName.trim();
    }
  }

  return tableSetup;
}

async function promptSettingsTarget(
  targetTool: TargetTool,
): Promise<SettingsTarget> {
  if (targetTool === "codex") {
    return select({
      message: t().codexSettingsTargetPrompt,
      choices: [
        {
          name: t().codexSettingsGlobal,
          value: "global" as const,
        },
        {
          name: t().codexSettingsProject,
          value: "project" as const,
        },
      ],
    });
  }

  return select({
    message: t().settingsTargetPrompt,
    choices: [
      {
        name: "Global (~/.claude/settings.json)",
        value: "global" as const,
      },
      {
        name: "Project (.claude/settings.json)",
        value: "project" as const,
      },
      {
        name: "Local (.claude/settings.local.json)",
        value: "local" as const,
      },
    ],
  });
}

export async function promptExperimentName(): Promise<string> {
  return input({
    message: t().experimentNamePrompt,
  });
}

export async function promptExperimentRetryAction(): Promise<ExperimentRetryAction> {
  return select({
    message: t().experimentRetryPrompt,
    choices: [
      {
        name: t().experimentRetryWithAnotherName,
        value: "retry" as const,
      },
      {
        name: t().experimentSkipLink,
        value: "skip" as const,
      },
    ],
  });
}

async function promptContentOptions(
  enabledSignals: Signal[],
): Promise<TelemetryContentOptions> {
  const tracesEnabled = enabledSignals.includes("traces");
  const selected = await checkbox({
    message: t().selectContentOptions,
    choices: [
      {
        name: t().contentUserPrompts,
        value: "logUserPrompts" as const,
        checked: true,
      },
      {
        name: t().contentToolDetails,
        value: "logToolDetails" as const,
        checked: true,
      },
      ...(tracesEnabled
        ? [
            {
              name: t().contentToolContent,
              value: "logToolContent" as const,
              checked: true,
            },
          ]
        : []),
    ],
  });

  return {
    logUserPrompts: selected.includes("logUserPrompts"),
    logToolDetails: selected.includes("logToolDetails"),
    logToolContent: tracesEnabled && selected.includes("logToolContent"),
  };
}

async function promptCodexContentOptions(): Promise<TelemetryContentOptions> {
  const logUserPrompts = await confirm({
    message: t().codexLogUserPromptPrompt,
    default: false,
  });
  return {
    logUserPrompts,
    logToolDetails: false,
    logToolContent: false,
  };
}

export async function collectUserConfig(): Promise<UserConfig> {
  const locale = await promptLocale();
  setLocale(locale);

  const targetTool = await promptTargetTool();
  const destination = await promptDestination();

  if (destination === "custom") {
    const endpoint = await promptCustomEndpoint();
    const authScheme = await promptCustomAuthScheme();
    const authorizationCredential = await promptCustomCredential(authScheme);
    const enabledSignals = await promptSignals();
    const signalPaths = await promptCustomSignalPaths(enabledSignals);
    const settingsTarget = await promptSettingsTarget(targetTool);
    const contentOptions =
      targetTool === "codex"
        ? await promptCodexContentOptions()
        : await promptContentOptions(enabledSignals);

    return {
      destination: "custom",
      targetTool,
      endpoint,
      authScheme,
      authorizationCredential,
      enabledSignals,
      signalPaths,
      settingsTarget,
      contentOptions,
    };
  }

  const authMethod = targetTool === "codex" ? "pat" : await promptAuthMethod();
  if (targetTool === "codex") {
    console.log(t().codexPatOnlyNotice);
  }

  let workspaceUrl: string;
  let scriptLocation = "";
  let pat: string | undefined;
  let profileName: string | undefined;

  if (authMethod === "u2m") {
    const profiles = await parseDatabricksCfg();
    profileName = await promptProfileName(profiles);
    workspaceUrl = await resolveWorkspaceUrlFromProfile(profileName, profiles);
  } else if (authMethod === "m2m") {
    workspaceUrl = await promptWorkspaceUrl();
  } else {
    workspaceUrl = await promptWorkspaceUrl();
    pat = await promptPat();
  }

  const tableSetup = await promptTableSetup(targetTool);
  const settingsTarget = await promptSettingsTarget(targetTool);
  const enabledSignals = await promptSignals();
  const contentOptions =
    targetTool === "codex"
      ? await promptCodexContentOptions()
      : await promptContentOptions(enabledSignals);
  if (targetTool === "claude-code" && authMethod !== "pat") {
    scriptLocation = await promptScriptLocation();
  }

  return {
    destination: "databricks",
    targetTool,
    workspaceUrl,
    authMethod,
    scriptLocation,
    profileName,
    pat,
    enabledSignals,
    tableSetup,
    settingsTarget,
    contentOptions,
  };
}

export async function confirmApply(): Promise<boolean> {
  return confirm({
    message: t().confirmApply,
    default: true,
  });
}
