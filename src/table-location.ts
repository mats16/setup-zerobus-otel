import type { Signal, UcTablePrefix } from "./types.js";

const SIGNAL_TABLE_SUFFIX: Record<Signal, string> = {
  logs: "otel_logs",
  metrics: "otel_metrics",
  traces: "otel_spans",
};

export function formatUcTablePrefix(location: UcTablePrefix): string {
  return `${location.catalogName}.${location.schemaName}.${location.tablePrefix}`;
}

export function formatLegacyTablePrefix(location: UcTablePrefix): string {
  return `${formatUcTablePrefix(location)}_`;
}

export function fallbackTableName(
  location: UcTablePrefix,
  signal: Signal,
): string {
  return `${formatLegacyTablePrefix(location)}${SIGNAL_TABLE_SUFFIX[signal]}`;
}
