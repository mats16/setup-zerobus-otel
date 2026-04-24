export type Locale = "ja" | "en";

export interface Messages {
  // prompts
  urlMustBeHttps: string;
  enterValidHostname: string;
  enterValidUrl: string;
  selectAuthMethod: string;
  authU2m: string;
  authM2m: string;
  authPat: string;
  noProfileFound: string;
  selectProfile: string;
  enterProfileName: string;
  enterProfileNameValidation: string;
  profileResolved: (name: string, host: string) => string;
  profileNotFound: (name: string) => string;
  enterWorkspaceUrlManually: string;
  scriptLocationPrompt: string;
  enterToken: string;
  tokenRequired: string;
  selectSignals: string;
  selectAtLeastOne: string;
  selectTableSetupMode: string;
  tableSetupCreate: string;
  tableSetupExisting: string;
  tableSchemaPrompt: string;
  tableSchemaValidation: string;
  tablePrefixPrompt: string;
  tablePrefixValidation: string;
  experimentNamePrompt: string;
  experimentRetryPrompt: string;
  experimentRetryWithAnotherName: string;
  experimentSkipLink: string;
  settingsTargetPrompt: string;
  selectContentOptions: string;
  contentUserPrompts: string;
  contentToolDetails: string;
  contentToolContent: string;
  confirmApply: string;

  // index (banner, preview, summary)
  previewHeader: string;
  previewTarget: string;
  previewTableSetup: string;
  previewTableCreate: string;
  previewTableExisting: string;
  previewScript: string;
  previewFooter: string;
  ensuringSchema: (schema: string) => string;
  schemaReady: (schema: string) => string;
  creatingTables: string;
  createdTables: string;
  creatingExperiment: (name: string) => string;
  linkedExperiment: (name: string, id: string) => string;
  experimentLinkFailed: (message: string) => string;
  experimentLinkSkipped: string;
  setupComplete: string;
  nextSteps: string;
  u2mNextStep: (profile: string) => string;
  u2mNextStepDesc: string;
  m2mNextStep1: string;
  m2mNextStep2: string;
  cancelled: string;
  cancelledNoChanges: string;

  // file-writer
  settingsReadError: (path: string, message: string) => string;

  // databricks-api
  missingProfileName: string;
  missingPat: string;
  missingM2mEnv: string;
  tokenParseError: string;
  databricksCliNotFound: string;
  currentUserError: string;
  databricksApiError: (status: number, message: string) => string;
  sqlWarehouseMayBeRequired: string;
}

const ja: Messages = {
  urlMustBeHttps: "URL は https である必要があります",
  enterValidHostname: "有効なホスト名を入力してください",
  enterValidUrl: "有効な URL を入力してください",
  selectAuthMethod: "どの authorization method を使用しますか?",
  authU2m: "OAuth for users (U2M) — Databricks CLI 必須",
  authM2m: "OAuth for service principals (M2M) — client_id + client_secret",
  authPat: "Personal Access Token (PAT) — 静的トークン",
  noProfileFound: "  ~/.databrickscfg に対象プロファイルが見つかりません。",
  selectProfile: "どの Databricks CLI プロファイルを使用しますか?",
  enterProfileName: "Databricks CLI プロファイル名は何ですか?",
  enterProfileNameValidation: "プロファイル名を入力してください",
  profileResolved: (name, host) => `  プロファイル "${name}" から取得: ${host}`,
  profileNotFound: (name) =>
    `  警告: プロファイル "${name}" が ~/.databrickscfg に見つかりません。`,
  enterWorkspaceUrlManually: "  Workspace URL を手動で入力してください。",
  scriptLocationPrompt: "トークンヘルパースクリプトはどこに保存しますか?",
  enterToken: "Personal Access Token は何ですか?",
  tokenRequired: "トークンを入力してください",
  selectSignals: "どのシグナルを有効化しますか?",
  selectAtLeastOne: "少なくとも1つ選択してください",
  selectTableSetupMode: "テーブルはどのように準備しますか?",
  tableSetupCreate: "新規にテーブルを作成",
  tableSetupExisting: "既存テーブルを使用",
  tableSchemaPrompt: "書き込み先スキーマは何ですか? (catalog.schema)",
  tableSchemaValidation: "catalog.schema の形式で入力してください",
  tablePrefixPrompt: "テーブルプレフィックスは何ですか?",
  tablePrefixValidation:
    "プレフィックスを入力してください（ドット不可、末尾 _ 不可）",
  experimentNamePrompt:
    "MLflow Experiment 名は何ですか? (相対名のみ / 空なら紐づけなし)",
  experimentRetryPrompt: "MLflow Experiment の紐づけはどうしますか?",
  experimentRetryWithAnotherName: "別の Experiment 名で再試行",
  experimentSkipLink: "Experiment 紐づけをスキップ",
  settingsTargetPrompt: "Claude Code のどの設定スコープに書き込みますか?",
  selectContentOptions: "テレメトリには何を含めますか?",
  contentUserPrompts: "ユーザープロンプト",
  contentToolDetails: "ツール実行詳細",
  contentToolContent: "ツール入出力内容",
  confirmApply: "この設定を適用しますか?",

  previewHeader: "─── 設定プレビュー ───",
  previewTarget: "書き込み先",
  previewTableSetup: "テーブル",
  previewTableCreate: "新規作成",
  previewTableExisting: "既存利用",
  previewScript: "スクリプト",
  previewFooter: "──────────────────────",
  ensuringSchema: (schema) =>
    `  Unity Catalog schema "${schema}" を確認/作成しています...`,
  schemaReady: (schema) =>
    `  Unity Catalog schema "${schema}" の準備が完了しました。`,
  creatingTables: "  Databricks にテーブル作成リクエストを送信しています...",
  createdTables: "  テーブル作成/取得が完了しました。",
  creatingExperiment: (name) =>
    `  MLflow Experiment "${name}" を作成/取得して紐づけています...`,
  linkedExperiment: (name, id) =>
    `  MLflow Experiment "${name}" (ID: ${id}) を紐づけました。`,
  experimentLinkFailed: (message) =>
    `  MLflow Experiment の作成/紐づけに失敗しました: ${message}`,
  experimentLinkSkipped: "  MLflow Experiment の紐づけをスキップします。",
  setupComplete: "  設定が完了しました!",
  nextSteps: "  次のステップ:",
  u2mNextStep: (profile) => `    databricks auth login --profile ${profile}`,
  u2mNextStepDesc: "    を実行して認証してください。",
  m2mNextStep1: "    DATABRICKS_CLIENT_ID と DATABRICKS_CLIENT_SECRET を",
  m2mNextStep2: "    環境変数に設定してください。",
  cancelled: "  キャンセルしました。",
  cancelledNoChanges: "  キャンセルしました。変更はありません。",

  settingsReadError: (p, message) =>
    `settings.json の読み込みに失敗しました (${p}): ${message}`,

  missingProfileName: "Databricks CLI プロファイル名がありません",
  missingPat: "Personal Access Token がありません",
  missingM2mEnv:
    "DATABRICKS_CLIENT_ID と DATABRICKS_CLIENT_SECRET を環境変数に設定してください",
  tokenParseError: "Databricks 認証トークンの取得結果を解析できませんでした",
  databricksCliNotFound:
    "Databricks CLI が見つかりません。https://docs.databricks.com/dev-tools/cli/install.html を参照してインストールしてください。",
  currentUserError: "Databricks の現在ユーザー名を取得できませんでした",
  databricksApiError: (status, message) =>
    `Databricks API エラー (${status}): ${message}`,
  sqlWarehouseMayBeRequired:
    "SQL warehouse ID が必要な可能性があります。今回は未指定で送信しています。Databricks 側で解決できない場合は、MLFLOW_TRACING_SQL_WAREHOUSE_ID 相当の指定が必要です。",
};

const en: Messages = {
  urlMustBeHttps: "URL must use https",
  enterValidHostname: "Please enter a valid hostname",
  enterValidUrl: "Please enter a valid URL",
  selectAuthMethod: "Which authorization method would you like to use?",
  authU2m: "OAuth for users (U2M) — requires Databricks CLI",
  authM2m: "OAuth for service principals (M2M) — client_id + client_secret",
  authPat: "Personal Access Token (PAT) — static token",
  noProfileFound: "  No matching profiles found in ~/.databrickscfg.",
  selectProfile: "Which Databricks CLI profile would you like to use?",
  enterProfileName: "What is your Databricks CLI profile named?",
  enterProfileNameValidation: "Please enter a profile name",
  profileResolved: (name, host) => `  Resolved from profile "${name}": ${host}`,
  profileNotFound: (name) =>
    `  Warning: Profile "${name}" not found in ~/.databrickscfg.`,
  enterWorkspaceUrlManually: "  Please enter the Workspace URL manually.",
  scriptLocationPrompt: "Where should the token helper script be saved?",
  enterToken: "What is your Personal Access Token?",
  tokenRequired: "Please enter a token",
  selectSignals: "Which signals would you like to enable?",
  selectAtLeastOne: "Please select at least one",
  selectTableSetupMode: "How would you like to prepare tables?",
  tableSetupCreate: "Create new tables",
  tableSetupExisting: "Use existing tables",
  tableSchemaPrompt: "What is the destination schema? (catalog.schema)",
  tableSchemaValidation: "Please use the format catalog.schema",
  tablePrefixPrompt: "What table prefix would you like to use?",
  tablePrefixValidation:
    "Please enter a prefix without dots or a trailing underscore",
  experimentNamePrompt:
    "What is your MLflow Experiment named? (relative name only / blank to skip linking)",
  experimentRetryPrompt: "How should MLflow Experiment linking proceed?",
  experimentRetryWithAnotherName: "Retry with another name",
  experimentSkipLink: "Skip Experiment linking",
  settingsTargetPrompt: "Which Claude Code settings scope should be updated?",
  selectContentOptions: "What should telemetry include?",
  contentUserPrompts: "User prompts",
  contentToolDetails: "Tool execution details",
  contentToolContent: "Tool input/output content",
  confirmApply: "Apply this configuration?",

  previewHeader: "─── Configuration Preview ───",
  previewTarget: "Target",
  previewTableSetup: "Tables",
  previewTableCreate: "Create",
  previewTableExisting: "Existing",
  previewScript: "Script",
  previewFooter: "─────────────────────────────",
  ensuringSchema: (schema) =>
    `  Ensuring Unity Catalog schema "${schema}" exists...`,
  schemaReady: (schema) => `  Unity Catalog schema "${schema}" is ready.`,
  creatingTables: "  Sending table creation request to Databricks...",
  createdTables: "  Table creation/get completed.",
  creatingExperiment: (name) =>
    `  Creating/getting and linking MLflow Experiment "${name}"...`,
  linkedExperiment: (name, id) =>
    `  Linked MLflow Experiment "${name}" (ID: ${id}).`,
  experimentLinkFailed: (message) =>
    `  MLflow Experiment create/link failed: ${message}`,
  experimentLinkSkipped: "  Skipping MLflow Experiment linking.",
  setupComplete: "  Setup complete!",
  nextSteps: "  Next steps:",
  u2mNextStep: (profile) => `    databricks auth login --profile ${profile}`,
  u2mNextStepDesc: "    Run the above command to authenticate.",
  m2mNextStep1: "    Set DATABRICKS_CLIENT_ID and DATABRICKS_CLIENT_SECRET",
  m2mNextStep2: "    as environment variables.",
  cancelled: "  Cancelled.",
  cancelledNoChanges: "  Cancelled. No changes were made.",

  settingsReadError: (p, message) =>
    `Failed to read settings.json (${p}): ${message}`,

  missingProfileName: "Databricks CLI profile name is missing",
  missingPat: "Personal Access Token is missing",
  missingM2mEnv:
    "Set DATABRICKS_CLIENT_ID and DATABRICKS_CLIENT_SECRET as environment variables",
  tokenParseError: "Failed to parse Databricks auth token response",
  databricksCliNotFound:
    "Databricks CLI not found. Please install it: https://docs.databricks.com/dev-tools/cli/install.html",
  currentUserError: "Failed to resolve the current Databricks username",
  databricksApiError: (status, message) =>
    `Databricks API error (${status}): ${message}`,
  sqlWarehouseMayBeRequired:
    "A SQL warehouse ID may be required. This CLI sent the request without one for now. If Databricks cannot resolve it, an MLFLOW_TRACING_SQL_WAREHOUSE_ID-equivalent setting is needed.",
};

const locales: Record<Locale, Messages> = { ja, en };

let currentLocale: Locale = "en";

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function t(): Messages {
  return locales[currentLocale];
}
