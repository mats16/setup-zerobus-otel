import {
  createOrGetExperiment,
  createOrGetTraceLocation,
  ensureSchemaExists,
  linkExperimentTraceLocation,
} from "./databricks-api.js";
import { generateConfig } from "./config-generator.js";
import { applyConfig } from "./file-writer.js";
import { t } from "./i18n.js";
import {
  collectUserConfig,
  confirmApply,
  promptExperimentName,
  promptExperimentRetryAction,
} from "./prompts.js";
import type {
  DatabricksUserConfig,
  GeneratedConfig,
  UserConfig,
} from "./types.js";

function printBanner(): void {
  console.log();
  console.log("  setup-agent-otel");
  console.log("  Configure OpenTelemetry for Claude Code or Codex");
  console.log();
}

function previewTargetPath(userConfig: UserConfig): string {
  if (userConfig.targetTool === "codex") {
    return userConfig.settingsTarget === "global"
      ? "~/.codex/config.toml"
      : ".codex/config.toml";
  }
  return userConfig.settingsTarget === "global"
    ? "~/.claude/settings.json"
    : userConfig.settingsTarget === "local"
      ? ".claude/settings.local.json"
      : ".claude/settings.json";
}

function maskSecrets(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/Bearer [^,\s"]+/g, "Bearer ***");
  }
  if (Array.isArray(value)) {
    return value.map(maskSecrets);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, maskSecrets(entry)]),
    );
  }
  return value;
}

function printPreview(config: GeneratedConfig, userConfig: UserConfig): void {
  console.log();
  console.log(t().previewHeader);
  console.log();

  console.log(`  ${t().previewTarget}: ${previewTargetPath(userConfig)}`);
  const destinationLabel =
    userConfig.destination === "custom"
      ? t().destinationCustom
      : t().destinationDatabricks;
  console.log(`  ${t().previewDestination}: ${destinationLabel}`);
  if (userConfig.destination === "custom") {
    console.log(`  ${t().previewEndpoint}: ${userConfig.endpoint}`);
  } else {
    const tableSetup =
      userConfig.tableSetup.mode === "create"
        ? t().previewTableCreate
        : t().previewTableExisting;
    console.log(`  ${t().previewTableSetup}: ${tableSetup}`);
  }
  console.log();

  if (userConfig.targetTool === "codex") {
    console.log("  otel:");
    const masked = maskSecrets(config.codexConfig?.otel ?? {});
    const preview = JSON.stringify(masked, null, 2)
      .split("\n")
      .map((line) => `    ${line}`)
      .join("\n");
    console.log(preview);
  } else {
    console.log("  env:");
    for (const [key, value] of Object.entries(config.settingsAdditions.env)) {
      console.log(`    ${key}: ${maskSecrets(value)}`);
    }

    if (config.settingsAdditions.otelHeadersHelper) {
      console.log();
      console.log(
        `  otelHeadersHelper: ${config.settingsAdditions.otelHeadersHelper}`,
      );
    }
  }

  if (config.tokenScript) {
    console.log();
    console.log(`  ${t().previewScript}: ${config.tokenScript.filePath}`);
  }

  console.log();
  console.log(t().previewFooter);
  console.log();
}

async function prepareTables(userConfig: UserConfig): Promise<void> {
  if (userConfig.destination !== "databricks") {
    return;
  }
  if (userConfig.tableSetup.mode !== "create") {
    return;
  }

  console.log();
  const schema = `${userConfig.tableSetup.location.catalogName}.${userConfig.tableSetup.location.schemaName}`;
  console.log(t().ensuringSchema(schema));
  await ensureSchemaExists(userConfig);
  console.log(t().schemaReady(schema));

  console.log(t().creatingTables);
  const result = await createOrGetTraceLocation(userConfig);
  userConfig.tableSetup.resolvedTableNames = result.tableNames;
  console.log(t().createdTables);

  await linkExperimentWithRetry(userConfig);
}

async function linkExperimentWithRetry(
  userConfig: DatabricksUserConfig,
): Promise<void> {
  let experimentName = userConfig.tableSetup.experimentName;

  while (experimentName) {
    try {
      console.log(t().creatingExperiment(experimentName));
      const experimentId = await createOrGetExperiment(
        userConfig,
        experimentName,
      );
      userConfig.tableSetup.experimentName = experimentName;
      userConfig.tableSetup.experimentId = experimentId;
      await linkExperimentTraceLocation(userConfig, experimentId);
      console.log(t().linkedExperiment(experimentName, experimentId));
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(t().experimentLinkFailed(message));
      const action = await promptExperimentRetryAction();
      if (action === "skip") {
        userConfig.tableSetup.experimentName = undefined;
        userConfig.tableSetup.experimentId = undefined;
        console.log(t().experimentLinkSkipped);
        return;
      }

      experimentName = (await promptExperimentName()).trim();
      if (!experimentName) {
        userConfig.tableSetup.experimentName = undefined;
        userConfig.tableSetup.experimentId = undefined;
        console.log(t().experimentLinkSkipped);
        return;
      }
    }
  }
}

function printSummary(
  result: { settingsPath: string },
  userConfig: UserConfig,
): void {
  console.log();
  console.log(t().setupComplete);
  console.log();
  console.log(`  Settings: ${result.settingsPath}`);
  console.log(`  Signals:  ${userConfig.enabledSignals.join(", ")}`);
  console.log();

  if (userConfig.destination !== "databricks") {
    return;
  }

  if (
    userConfig.authMethod === "u2m" &&
    userConfig.tableSetup.mode !== "create"
  ) {
    const profile = userConfig.profileName ?? "DEFAULT";
    console.log(t().nextSteps);
    console.log(t().u2mNextStep(profile));
    console.log(t().u2mNextStepDesc);
  } else if (userConfig.authMethod === "m2m") {
    console.log(t().nextSteps);
    console.log(t().m2mNextStep1);
    console.log(t().m2mNextStep2);
  }
  console.log();
}

async function main(): Promise<void> {
  printBanner();

  const userConfig = await collectUserConfig();
  let generatedConfig = generateConfig(userConfig);

  printPreview(generatedConfig, userConfig);

  const confirmed = await confirmApply();
  if (!confirmed) {
    console.log();
    console.log(t().cancelledNoChanges);
    console.log();
    process.exit(0);
  }

  await prepareTables(userConfig);
  generatedConfig = generateConfig(userConfig);
  const result = await applyConfig(
    generatedConfig,
    userConfig.settingsTarget,
    userConfig.targetTool,
  );
  printSummary(result, userConfig);
}

main().catch((error: unknown) => {
  if (
    error instanceof Error &&
    (error.message.includes("User force closed") ||
      error.name === "ExitPromptError")
  ) {
    console.log();
    console.log(t().cancelled);
    console.log();
    process.exit(0);
  }
  console.error("\n  Error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
