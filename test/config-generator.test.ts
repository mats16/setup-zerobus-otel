import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { parse } from "smol-toml";
import { generateConfig } from "../src/config-generator.ts";
import { applyConfig } from "../src/file-writer.ts";
import type {
  CodexOtelConfig,
  CustomUserConfig,
  DatabricksUserConfig,
} from "../src/types.ts";

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

function baseConfig(
  overrides: Partial<DatabricksUserConfig> = {},
): DatabricksUserConfig {
  return {
    destination: "databricks",
    targetTool: "claude-code",
    workspaceUrl: "https://dbc.example.com",
    authMethod: "pat",
    scriptLocation: "",
    pat: "dapi-test-token",
    enabledSignals: ["logs", "metrics", "traces"],
    tableSetup: {
      mode: "existing",
      location: {
        catalogName: "main",
        schemaName: "default",
        tablePrefix: "claude",
      },
    },
    settingsTarget: "project",
    contentOptions: {
      logUserPrompts: true,
      logToolDetails: true,
      logToolContent: true,
    },
    ...overrides,
  };
}

function customConfig(
  overrides: Partial<CustomUserConfig> = {},
): CustomUserConfig {
  return {
    destination: "custom",
    targetTool: "claude-code",
    endpoint: "https://otel.example.com",
    authorizationToken: "custom-token",
    enabledSignals: ["logs", "metrics", "traces"],
    settingsTarget: "project",
    contentOptions: {
      logUserPrompts: true,
      logToolDetails: true,
      logToolContent: true,
    },
    ...overrides,
  };
}

async function withTempCwd<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const oldCwd = process.cwd();
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "setup-agent-otel-"));
  tempDirs.push(dir);
  process.chdir(dir);
  try {
    return await fn(dir);
  } finally {
    process.chdir(oldCwd);
  }
}

describe("generateConfig", () => {
  test("keeps existing Claude Code env generation", () => {
    const generated = generateConfig(baseConfig());

    expect(generated.tokenScript).toBeNull();
    expect(generated.codexConfig).toBeUndefined();
    expect(generated.settingsAdditions.env.CLAUDE_CODE_ENABLE_TELEMETRY).toBe(
      "1",
    );
    expect(
      generated.settingsAdditions.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT,
    ).toBe("https://dbc.example.com/api/2.0/otel/v1/logs");
    expect(
      generated.settingsAdditions.env.OTEL_EXPORTER_OTLP_TRACES_HEADERS,
    ).toContain("X-Databricks-UC-Table-Name=main.default.claude_otel_spans");
  });

  test("generates Codex PAT OTLP HTTP exporters per signal", () => {
    const generated = generateConfig(
      baseConfig({
        targetTool: "codex",
        tableSetup: {
          mode: "existing",
          location: {
            catalogName: "main",
            schemaName: "default",
            tablePrefix: "codex",
          },
        },
        contentOptions: {
          logUserPrompts: false,
          logToolDetails: false,
          logToolContent: false,
        },
      }),
    );

    const otel = generated.codexConfig?.otel;
    expect(otel?.log_user_prompt).toBe(false);
    expect(otel?.exporter).toEqual({
      "otlp-http": {
        endpoint: "https://dbc.example.com/api/2.0/otel/v1/logs",
        protocol: "binary",
        headers: {
          Authorization: "Bearer dapi-test-token",
          "content-type": "application/x-protobuf",
          "X-Databricks-UC-Table-Name": "main.default.codex_otel_logs",
        },
      },
    });
    expect(otel?.trace_exporter).toEqual({
      "otlp-http": {
        endpoint: "https://dbc.example.com/api/2.0/otel/v1/traces",
        protocol: "binary",
        headers: {
          Authorization: "Bearer dapi-test-token",
          "content-type": "application/x-protobuf",
          "X-Databricks-UC-Table-Name": "main.default.codex_otel_spans",
        },
      },
    });
    expect(otel?.metrics_exporter).toEqual({
      "otlp-http": {
        endpoint: "https://dbc.example.com/api/2.0/otel/v1/metrics",
        protocol: "binary",
        headers: {
          Authorization: "Bearer dapi-test-token",
          "content-type": "application/x-protobuf",
          "X-Databricks-UC-Table-Name": "main.default.codex_otel_metrics",
        },
      },
    });
  });

  test("sets disabled Codex signals to none", () => {
    const generated = generateConfig(
      baseConfig({
        targetTool: "codex",
        enabledSignals: ["logs"],
      }),
    );

    expect(generated.codexConfig?.otel.exporter).not.toBe("none");
    expect(generated.codexConfig?.otel.trace_exporter).toBe("none");
    expect(generated.codexConfig?.otel.metrics_exporter).toBe("none");
  });

  test("custom destination produces minimal Claude Code env", () => {
    const generated = generateConfig(customConfig());

    expect(generated.tokenScript).toBeNull();
    expect(generated.settingsAdditions.otelHeadersHelper).toBeUndefined();
    expect(generated.codexConfig).toBeUndefined();

    const env = generated.settingsAdditions.env;
    expect(env.CLAUDE_CODE_ENABLE_TELEMETRY).toBe("1");
    expect(env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT).toBe(
      "https://otel.example.com/v1/logs",
    );
    expect(env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT).toBe(
      "https://otel.example.com/v1/metrics",
    );
    expect(env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT).toBe(
      "https://otel.example.com/v1/traces",
    );
    expect(env.OTEL_EXPORTER_OTLP_LOGS_HEADERS).toBe(
      "Authorization=Bearer custom-token,content-type=application/x-protobuf",
    );
    expect(env.OTEL_EXPORTER_OTLP_LOGS_HEADERS).not.toContain(
      "X-Databricks-UC-Table-Name",
    );
    expect(env.DATABRICKS_HOST).toBeUndefined();
  });

  test("custom destination disables non-selected signals", () => {
    const generated = generateConfig(
      customConfig({ enabledSignals: ["logs"] }),
    );

    const env = generated.settingsAdditions.env;
    expect(env.OTEL_LOGS_EXPORTER).toBe("otlp");
    expect(env.OTEL_METRICS_EXPORTER).toBe("none");
    expect(env.OTEL_TRACES_EXPORTER).toBe("none");
  });

  test("custom destination Codex exporter omits Databricks header", () => {
    const generated = generateConfig(
      customConfig({
        targetTool: "codex",
        contentOptions: {
          logUserPrompts: false,
          logToolDetails: false,
          logToolContent: false,
        },
      }),
    );

    expect(generated.tokenScript).toBeNull();
    expect(generated.codexConfig?.otel.exporter).toEqual({
      "otlp-http": {
        endpoint: "https://otel.example.com/v1/logs",
        protocol: "binary",
        headers: {
          Authorization: "Bearer custom-token",
          "content-type": "application/x-protobuf",
        },
      },
    });
    expect(generated.codexConfig?.otel.trace_exporter).toEqual({
      "otlp-http": {
        endpoint: "https://otel.example.com/v1/traces",
        protocol: "binary",
        headers: {
          Authorization: "Bearer custom-token",
          "content-type": "application/x-protobuf",
        },
      },
    });
    expect(JSON.stringify(generated.codexConfig)).not.toContain(
      "X-Databricks-UC-Table-Name",
    );
  });
});

describe("applyConfig for Codex", () => {
  test("preserves unrelated TOML config and replaces otel", async () => {
    await withTempCwd(async (dir) => {
      const configPath = path.join(dir, ".codex", "config.toml");
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(
        configPath,
        'model = "gpt-5"\n\n[profiles.fast]\nmodel = "gpt-5-mini"\n\n[otel]\nenvironment = "prod"\n\n[otel.exporter.otlp-http]\nendpoint = "https://old.example.com/v1/logs"\n',
      );

      const generated = generateConfig(
        baseConfig({
          targetTool: "codex",
          enabledSignals: ["logs"],
        }),
      );
      await applyConfig(generated, "project", "codex");

      const parsed = parse(await fs.readFile(configPath, "utf-8")) as {
        model?: string;
        profiles?: { fast?: { model?: string } };
        otel?: CodexOtelConfig;
      };
      expect(parsed.model).toBe("gpt-5");
      expect(parsed.profiles?.fast?.model).toBe("gpt-5-mini");
      expect(parsed.otel?.exporter).not.toBe("none");
      expect(JSON.stringify(parsed.otel)).not.toContain("old.example.com");
      expect(parsed.otel?.trace_exporter).toBe("none");
      expect(parsed.otel?.metrics_exporter).toBe("none");
    });
  });

  test("fails before writing when existing TOML is invalid", async () => {
    await withTempCwd(async (dir) => {
      const configPath = path.join(dir, ".codex", "config.toml");
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, '[otel\nexporter = "none"\n');

      const generated = generateConfig(
        baseConfig({
          targetTool: "codex",
        }),
      );
      await expect(applyConfig(generated, "project", "codex")).rejects.toThrow(
        "config.toml",
      );
      expect(await fs.readFile(configPath, "utf-8")).toBe(
        '[otel\nexporter = "none"\n',
      );
    });
  });
});
