export type Locale = "ja" | "en";

export interface Messages {
  // prompts
  selectTargetTool: string;
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
  tablePrefixPrompt: string;
  tablePrefixValidation: string;
  settingsTargetPrompt: string;
  selectContentOptions: string;
  contentUserPrompts: string;
  contentToolDetails: string;
  contentToolContent: string;
  confirmApply: string;

  // index (banner, preview, summary)
  previewHeader: string;
  previewTarget: string;
  previewScript: string;
  previewFooter: string;
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
}

const ja: Messages = {
  selectTargetTool: "導入先のツールを選択してください:",
  urlMustBeHttps: "URL は https である必要があります",
  enterValidHostname: "有効なホスト名を入力してください",
  enterValidUrl: "有効な URL を入力してください",
  selectAuthMethod: "認証方式を選択してください:",
  authU2m: "U2M (User-to-Machine) — Databricks CLI 必須",
  authM2m:
    "M2M (Machine-to-Machine / Service Principal) — client_id + client_secret",
  authPat: "PAT (Personal Access Token) — 静的トークン",
  noProfileFound: "  ~/.databrickscfg に対象プロファイルが見つかりません。",
  selectProfile: "Databricks CLI プロファイルを選択してください:",
  enterProfileName: "Databricks CLI プロファイル名:",
  enterProfileNameValidation: "プロファイル名を入力してください",
  profileResolved: (name, host) => `  プロファイル "${name}" から取得: ${host}`,
  profileNotFound: (name) =>
    `  警告: プロファイル "${name}" が ~/.databrickscfg に見つかりません。`,
  enterWorkspaceUrlManually: "  Workspace URL を手動で入力してください。",
  scriptLocationPrompt: "トークンヘルパースクリプトの保存先ディレクトリ:",
  enterToken: "Personal Access Token:",
  tokenRequired: "トークンを入力してください",
  selectSignals: "有効化するシグナルを選択してください:",
  selectAtLeastOne: "少なくとも1つ選択してください",
  tablePrefixPrompt: "テーブルプレフィックス (catalog.schema.prefix_):",
  tablePrefixValidation:
    "catalog.schema.prefix の形式で入力してください（ドットが2つ以上必要）",
  settingsTargetPrompt: "設定の書き込み先:",
  selectContentOptions: "テレメトリに含める内容を選択してください:",
  contentUserPrompts: "ユーザープロンプト",
  contentToolDetails: "ツール実行詳細",
  contentToolContent: "ツール入出力内容",
  confirmApply: "この設定を適用しますか?",

  previewHeader: "─── 設定プレビュー ───",
  previewTarget: "書き込み先",
  previewScript: "スクリプト",
  previewFooter: "──────────────────────",
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
};

const en: Messages = {
  selectTargetTool: "Select the target tool:",
  urlMustBeHttps: "URL must use https",
  enterValidHostname: "Please enter a valid hostname",
  enterValidUrl: "Please enter a valid URL",
  selectAuthMethod: "Select authentication method:",
  authU2m: "U2M (User-to-Machine) — requires Databricks CLI",
  authM2m:
    "M2M (Machine-to-Machine / Service Principal) — client_id + client_secret",
  authPat: "PAT (Personal Access Token) — static token",
  noProfileFound: "  No matching profiles found in ~/.databrickscfg.",
  selectProfile: "Select a Databricks CLI profile:",
  enterProfileName: "Databricks CLI profile name:",
  enterProfileNameValidation: "Please enter a profile name",
  profileResolved: (name, host) => `  Resolved from profile "${name}": ${host}`,
  profileNotFound: (name) =>
    `  Warning: Profile "${name}" not found in ~/.databrickscfg.`,
  enterWorkspaceUrlManually: "  Please enter the Workspace URL manually.",
  scriptLocationPrompt: "Directory to save the token helper script:",
  enterToken: "Personal Access Token:",
  tokenRequired: "Please enter a token",
  selectSignals: "Select signals to enable:",
  selectAtLeastOne: "Please select at least one",
  tablePrefixPrompt: "Table prefix (catalog.schema.prefix_):",
  tablePrefixValidation:
    "Please use the format catalog.schema.prefix (at least 2 dots required)",
  settingsTargetPrompt: "Settings write target:",
  selectContentOptions: "Select telemetry content to include:",
  contentUserPrompts: "User prompts",
  contentToolDetails: "Tool execution details",
  contentToolContent: "Tool input/output content",
  confirmApply: "Apply this configuration?",

  previewHeader: "─── Configuration Preview ───",
  previewTarget: "Target",
  previewScript: "Script",
  previewFooter: "─────────────────────────────",
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
};

const locales: Record<Locale, Messages> = { ja, en };

let currentLocale: Locale = "en";

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(): Messages {
  return locales[currentLocale];
}
