import { generateConfig } from "./config-generator.js";
import { applyConfig } from "./file-writer.js";
import { t } from "./i18n.js";
import { collectUserConfig, confirmApply } from "./prompts.js";
import type { GeneratedConfig, UserConfig } from "./types.js";

function printBanner(): void {
  console.log();
  console.log("  setup-zerobus-otel");
  console.log("  Configure OpenTelemetry via Zerobus (Databricks)");
  console.log();
}

function printPreview(config: GeneratedConfig, userConfig: UserConfig): void {
  console.log();
  console.log(t().previewHeader);
  console.log();

  const target =
    userConfig.settingsTarget === "global"
      ? "~/.claude/settings.json"
      : ".claude/settings.json";
  console.log(`  ${t().previewTarget}: ${target}`);
  console.log();

  console.log("  env:");
  for (const [key, value] of Object.entries(config.settingsAdditions.env)) {
    if (key.includes("HEADERS") && value.includes("Authorization=Bearer ")) {
      const masked = value.replace(
        /Authorization=Bearer [^,]+/,
        "Authorization=Bearer ***",
      );
      console.log(`    ${key}: ${masked}`);
    } else {
      console.log(`    ${key}: ${value}`);
    }
  }

  if (config.settingsAdditions.otelHeadersHelper) {
    console.log();
    console.log(
      `  otelHeadersHelper: ${config.settingsAdditions.otelHeadersHelper}`,
    );
  }

  if (config.tokenScript) {
    console.log();
    console.log(`  ${t().previewScript}: ${config.tokenScript.filePath}`);
  }

  console.log();
  console.log(t().previewFooter);
  console.log();
}

function printSummary(
  result: { settingsPath: string; scriptPath: string | null },
  userConfig: UserConfig,
): void {
  console.log();
  console.log(t().setupComplete);
  console.log();
  console.log(`  Settings: ${result.settingsPath}`);
  if (result.scriptPath) {
    console.log(`  Script:   ${result.scriptPath}`);
  }
  console.log(`  Signals:  ${userConfig.enabledSignals.join(", ")}`);
  console.log();

  if (userConfig.authMethod === "u2m") {
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
  const generatedConfig = generateConfig(userConfig);

  printPreview(generatedConfig, userConfig);

  const confirmed = await confirmApply();
  if (!confirmed) {
    console.log();
    console.log(t().cancelledNoChanges);
    console.log();
    process.exit(0);
  }

  const result = await applyConfig(generatedConfig, userConfig.settingsTarget);
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
