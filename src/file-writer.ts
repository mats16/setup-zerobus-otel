import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parse, stringify } from "smol-toml";
import { t } from "./i18n.js";
import type {
  CodexConfigAdditions,
  GeneratedConfig,
  GeneratedScript,
  SettingsAdditions,
  SettingsTarget,
  TargetTool,
} from "./types.js";

function resolveClaudeSettingsPath(target: SettingsTarget): string {
  if (target === "global") {
    return path.join(os.homedir(), ".claude", "settings.json");
  }
  if (target === "local") {
    return path.join(process.cwd(), ".claude", "settings.local.json");
  }
  return path.join(process.cwd(), ".claude", "settings.json");
}

function resolveCodexSettingsPath(target: SettingsTarget): string {
  if (target === "global") {
    return path.join(os.homedir(), ".codex", "config.toml");
  }
  return path.join(process.cwd(), ".codex", "config.toml");
}

async function readExistingSettings(
  filePath: string,
): Promise<Record<string, unknown>> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw new Error(t().settingsReadError(filePath, (err as Error).message));
  }
}

async function readExistingToml(
  filePath: string,
): Promise<Record<string, unknown>> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return parse(content) as Record<string, unknown>;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw new Error(t().tomlReadError(filePath, (err as Error).message));
  }
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = result[key];
    if (
      typeof sourceVal === "object" &&
      sourceVal !== null &&
      !Array.isArray(sourceVal) &&
      typeof targetVal === "object" &&
      targetVal !== null &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      );
    } else {
      result[key] = sourceVal;
    }
  }
  return result;
}

function mergeSettings(
  existing: Record<string, unknown>,
  additions: SettingsAdditions,
): Record<string, unknown> {
  const toMerge: Record<string, unknown> = {
    env: additions.env,
  };
  if (additions.otelHeadersHelper !== undefined) {
    toMerge.otelHeadersHelper = additions.otelHeadersHelper;
  }
  return deepMerge(existing, toMerge);
}

// Codex otel section is generated atomically — replace rather than deep-merge
// so stale sub-keys from a previous run are not carried over.
function mergeCodexConfig(
  existing: Record<string, unknown>,
  additions: CodexConfigAdditions,
): Record<string, unknown> {
  return {
    ...existing,
    otel: additions.otel,
  };
}

async function writeSettings(
  filePath: string,
  settings: Record<string, unknown>,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(
    filePath,
    `${JSON.stringify(settings, null, 2)}\n`,
    "utf-8",
  );
}

async function writeToml(
  filePath: string,
  settings: Record<string, unknown>,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, stringify(settings), "utf-8");
}

async function writeScript(script: GeneratedScript): Promise<void> {
  await fs.mkdir(path.dirname(script.filePath), { recursive: true });
  await fs.writeFile(script.filePath, script.content, "utf-8");
  await fs.chmod(script.filePath, 0o755);
}

export async function applyConfig(
  config: GeneratedConfig,
  settingsTarget: SettingsTarget,
  targetTool: TargetTool,
): Promise<{ settingsPath: string }> {
  if (targetTool === "codex") {
    if (!config.codexConfig) {
      throw new Error("codexConfig is required for Codex");
    }
    const settingsPath = resolveCodexSettingsPath(settingsTarget);
    const existing = await readExistingToml(settingsPath);
    const merged = mergeCodexConfig(existing, config.codexConfig);
    await writeToml(settingsPath, merged);
    return { settingsPath };
  }

  const settingsPath = resolveClaudeSettingsPath(settingsTarget);
  const existing = await readExistingSettings(settingsPath);
  const merged = mergeSettings(existing, config.settingsAdditions);

  const writes: Promise<void>[] = [writeSettings(settingsPath, merged)];
  if (config.tokenScript) {
    writes.push(writeScript(config.tokenScript));
  }
  await Promise.all(writes);

  return { settingsPath };
}
