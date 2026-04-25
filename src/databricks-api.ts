import { execFileSync } from "node:child_process";
import { t } from "./i18n.js";
import type {
  DatabricksUserConfig,
  SignalTableNames,
  UcTablePrefix,
} from "./types.js";

interface UcTablePrefixResponse {
  catalog_name?: string;
  schema_name?: string;
  table_prefix?: string;
  spans_table_name?: string;
  logs_table_name?: string;
  metrics_table_name?: string;
  location_id?: string;
}

interface ExperimentResponse {
  experiment_id?: string;
  experiment?: {
    experiment_id?: string;
  };
}

interface CurrentUserResponse {
  userName?: string;
}

export interface TraceLocationResult {
  tableNames: SignalTableNames;
  ucTablePrefix: UcTablePrefixResponse;
}

class DatabricksApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly apiMessage: string,
    readonly errorCode?: string,
  ) {
    const suffix = isSqlWarehouseResolutionError(apiMessage)
      ? `\n${t().sqlWarehouseMayBeRequired}`
      : "";
    super(t().databricksApiError(status, `${apiMessage}${suffix}`));
  }
}

function buildUcTablePrefixBody(
  location: UcTablePrefix,
  tableNames?: SignalTableNames,
): UcTablePrefixResponse {
  const body: UcTablePrefixResponse = {
    catalog_name: location.catalogName,
    schema_name: location.schemaName,
    table_prefix: location.tablePrefix,
  };
  if (tableNames?.traces) body.spans_table_name = tableNames.traces;
  if (tableNames?.logs) body.logs_table_name = tableNames.logs;
  if (tableNames?.metrics) body.metrics_table_name = tableNames.metrics;
  return body;
}

function parseTokenOutput(output: Buffer): string {
  try {
    const parsed = JSON.parse(output.toString()) as { access_token?: string };
    if (parsed.access_token) return parsed.access_token;
  } catch {
    // Fall through to the shared error below.
  }
  throw new Error(t().tokenParseError);
}

function getCliAccessToken(profileName: string): string {
  try {
    return parseTokenOutput(
      execFileSync("databricks", ["auth", "token", "--profile", profileName], {
        timeout: 10000,
      }),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(t().databricksCliNotFound);
    }
    execFileSync("databricks", ["auth", "login", "--profile", profileName], {
      stdio: "inherit",
      timeout: 120_000,
    });
    return parseTokenOutput(
      execFileSync("databricks", ["auth", "token", "--profile", profileName], {
        timeout: 10000,
      }),
    );
  }
}

async function getAccessToken(config: DatabricksUserConfig): Promise<string> {
  if (config.authMethod === "pat") {
    if (!config.pat) throw new Error(t().missingPat);
    return config.pat;
  }

  if (config.authMethod === "u2m") {
    if (!config.profileName) throw new Error(t().missingProfileName);
    return getCliAccessToken(config.profileName);
  }

  const clientId = process.env.DATABRICKS_CLIENT_ID;
  const clientSecret = process.env.DATABRICKS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(t().missingM2mEnv);
  }

  const response = await fetch(`${config.workspaceUrl}/oidc/v1/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${clientId}:${clientSecret}`,
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=all-apis",
  });
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    error_description?: string;
    error?: string;
    message?: string;
  };
  if (!response.ok || !body.access_token) {
    throw new Error(
      t().databricksApiError(
        response.status,
        body.error_description ??
          body.message ??
          body.error ??
          response.statusText,
      ),
    );
  }
  return body.access_token;
}

function isSqlWarehouseResolutionError(message: string): boolean {
  return (
    message.includes("SQL warehouse") ||
    message.includes("sql_warehouse") ||
    message.includes("Could not resolve a SQL warehouse ID")
  );
}

async function databricksFetch<T>(
  config: DatabricksUserConfig,
  endpoint: string,
  options: {
    method: "GET" | "POST";
    body?: unknown;
  },
): Promise<T> {
  const token = await getAccessToken(config);
  const response = await fetch(`${config.workspaceUrl}${endpoint}`, {
    method: options.method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const rawBody = await response.text();
  const parsedBody = rawBody
    ? (safeParseJson(rawBody) as { message?: string; error_code?: string })
    : {};

  if (!response.ok) {
    const message =
      parsedBody.message ??
      parsedBody.error_code ??
      rawBody ??
      response.statusText;
    throw new DatabricksApiRequestError(
      response.status,
      message,
      parsedBody.error_code,
    );
  }

  return parsedBody as T;
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function isAlreadyExistsError(error: unknown): boolean {
  return (
    error instanceof DatabricksApiRequestError &&
    (error.status === 409 ||
      error.errorCode === "RESOURCE_ALREADY_EXISTS" ||
      error.errorCode === "ALREADY_EXISTS" ||
      error.apiMessage.includes("already exists"))
  );
}

export async function ensureSchemaExists(
  config: DatabricksUserConfig,
): Promise<void> {
  const { catalogName, schemaName } = config.tableSetup.location;
  try {
    await databricksFetch(config, "/api/2.1/unity-catalog/schemas", {
      method: "POST",
      body: {
        name: schemaName,
        catalog_name: catalogName,
      },
    });
  } catch (error) {
    if (!isAlreadyExistsError(error)) {
      throw error;
    }
  }
}

export async function createOrGetTraceLocation(
  config: DatabricksUserConfig,
): Promise<TraceLocationResult> {
  const body = {
    uc_table_prefix: buildUcTablePrefixBody(config.tableSetup.location),
  };
  const response = await databricksFetch<{
    uc_table_prefix?: UcTablePrefixResponse;
  }>(config, "/api/5.0/mlflow/tracing/locations", {
    method: "POST",
    body,
  });

  const ucTablePrefix = response.uc_table_prefix ?? {};
  return {
    ucTablePrefix,
    tableNames: {
      logs: ucTablePrefix.logs_table_name,
      metrics: ucTablePrefix.metrics_table_name,
      traces: ucTablePrefix.spans_table_name,
    },
  };
}

async function getExperimentByName(
  config: DatabricksUserConfig,
  name: string,
): Promise<string | null> {
  try {
    const response = await databricksFetch<ExperimentResponse>(
      config,
      `/api/2.0/mlflow/experiments/get-by-name?experiment_name=${encodeURIComponent(
        name,
      )}`,
      { method: "GET" },
    );
    return response.experiment?.experiment_id ?? null;
  } catch {
    return null;
  }
}

async function getCurrentUsername(
  config: DatabricksUserConfig,
): Promise<string> {
  const response = await databricksFetch<CurrentUserResponse>(
    config,
    "/api/2.0/preview/scim/v2/Me",
    { method: "GET" },
  );
  if (!response.userName) {
    throw new Error(t().currentUserError);
  }
  return response.userName;
}

async function resolveExperimentName(
  config: DatabricksUserConfig,
  name: string,
): Promise<string> {
  const trimmedName = name.trim();
  if (trimmedName.startsWith("/")) {
    return trimmedName;
  }
  const username = await getCurrentUsername(config);
  return `/Users/${username}/${trimmedName}`;
}

export async function createOrGetExperiment(
  config: DatabricksUserConfig,
  name: string,
): Promise<string> {
  const resolvedName = await resolveExperimentName(config, name);
  try {
    const response = await databricksFetch<ExperimentResponse>(
      config,
      "/api/2.0/mlflow/experiments/create",
      {
        method: "POST",
        body: { name: resolvedName },
      },
    );
    if (response.experiment_id) return response.experiment_id;
  } catch (error) {
    if (!isAlreadyExistsError(error)) throw error;
    const existingExperimentId = await getExperimentByName(
      config,
      resolvedName,
    );
    if (existingExperimentId) return existingExperimentId;
    throw error;
  }

  throw new Error(t().databricksApiError(200, "Missing experiment_id"));
}

export async function linkExperimentTraceLocation(
  config: DatabricksUserConfig,
  experimentId: string,
): Promise<void> {
  const ucTablePrefix = buildUcTablePrefixBody(
    config.tableSetup.location,
    config.tableSetup.resolvedTableNames,
  );
  await databricksFetch(
    config,
    `/api/5.0/mlflow/experiments/${experimentId}/trace-location:link`,
    {
      method: "POST",
      body: {
        experiment_id: experimentId,
        uc_table_prefix: ucTablePrefix,
      },
    },
  );
}
