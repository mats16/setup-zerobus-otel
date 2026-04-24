import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { checkbox, confirm, input, password, select } from "@inquirer/prompts";
import { type Locale, setLocale, t } from "./i18n.js";
import type {
  AuthMethod,
  SettingsTarget,
  Signal,
  TargetTool,
  TelemetryContentOptions,
  UserConfig,
} from "./types.js";

export async function promptLocale(): Promise<Locale> {
  return select({
    message: "Language / 言語:",
    choices: [
      { name: "English", value: "en" as const },
      { name: "日本語", value: "ja" as const },
    ],
  });
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
    message: "Databricks workspace URL:",
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

async function promptTablePrefix(): Promise<string> {
  return input({
    message: t().tablePrefixPrompt,
    default: "main.default.claude_",
    validate: (value) => {
      const dots = (value.match(/\./g) || []).length;
      if (dots < 2) {
        return t().tablePrefixValidation;
      }
      return true;
    },
  });
}

async function promptSettingsTarget(): Promise<SettingsTarget> {
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
    ],
  });
}

async function promptContentOptions(): Promise<TelemetryContentOptions> {
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
      {
        name: t().contentToolContent,
        value: "logToolContent" as const,
        checked: true,
      },
    ],
  });

  return {
    logUserPrompts: selected.includes("logUserPrompts"),
    logToolDetails: selected.includes("logToolDetails"),
    logToolContent: selected.includes("logToolContent"),
  };
}

export async function collectUserConfig(): Promise<UserConfig> {
  const locale = await promptLocale();
  setLocale(locale);

  const targetTool: TargetTool = "claude-code";
  const authMethod = await promptAuthMethod();

  let workspaceUrl: string;
  let scriptLocation = "";
  let pat: string | undefined;
  let profileName: string | undefined;

  if (authMethod === "u2m") {
    const profiles = await parseDatabricksCfg();
    profileName = await promptProfileName(profiles);
    workspaceUrl = await resolveWorkspaceUrlFromProfile(profileName, profiles);
    scriptLocation = await promptScriptLocation();
  } else if (authMethod === "m2m") {
    workspaceUrl = await promptWorkspaceUrl();
    scriptLocation = await promptScriptLocation();
  } else {
    workspaceUrl = await promptWorkspaceUrl();
    pat = await promptPat();
  }

  const enabledSignals = await promptSignals();
  const tablePrefix = await promptTablePrefix();
  const settingsTarget = await promptSettingsTarget();
  const contentOptions = await promptContentOptions();

  return {
    targetTool,
    workspaceUrl,
    authMethod,
    scriptLocation,
    profileName,
    pat,
    enabledSignals,
    tablePrefix,
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
