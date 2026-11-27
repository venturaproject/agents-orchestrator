"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import type { Locale, MessageKey } from "@/lib/translations";

type RunHistoryItem = {
  id: string;
  prompt: string;
  createdAt: string;
  status: string;
  tasks: unknown[];
  result?: { summary?: string };
};

type RunsHistoryProps = {
  runs: RunHistoryItem[];
  locale: Locale;
  t: (key: MessageKey) => string;
  statusLabel: (status: string) => string;
  onOpen: (id: string) => void;
  onNew: () => void;
};

function statusFilterValue(status: string): "completed" | "inProgress" | "failed" | "other" {
  if (["Completado", "Completed"].includes(status)) return "completed";
  if (["En curso", "In progress"].includes(status)) return "inProgress";
  if (["Fallida", "Failed"].includes(status)) return "failed";
  return "other";
}

function formatCreatedAt(value: string, locale: Locale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function RunsHistory({ runs, locale, t, statusLabel, onOpen, onNew }: RunsHistoryProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const filteredRuns = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(locale);
    return runs.filter((run) => {
      const matchesQuery = !query ||
        `${run.prompt} ${run.result?.summary || ""}`.toLocaleLowerCase(locale).includes(query);
      const matchesStatus = statusFilter === "all" || statusFilterValue(run.status) === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [locale, runs, search, statusFilter]);

  return (
    <section aria-labelledby="runs-heading">
      <div className="page-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> {t("workspace").toUpperCase()}</div>
          <h1 id="runs-heading">{t("agentRuns")}</h1>
          <p>{t("runsDescription")}</p>
        </div>
        <button className="new-run-btn" type="button" onClick={onNew}>{t("newRun")}</button>
      </div>

      <div className="runs-toolbar">
        <label className="runs-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            aria-label={t("searchRuns")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchRunsPlaceholder")}
          />
        </label>
        <label className="runs-status-filter">
          <span>{t("filterByStatus")}</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">{t("allStatuses")}</option>
            <option value="completed">{t("completed")}</option>
            <option value="inProgress">{t("inProgress")}</option>
            <option value="failed">{t("failed")}</option>
          </select>
        </label>
        <span className="runs-result-count" aria-live="polite">
          {t("runsResultCount").replace("{count}", String(filteredRuns.length)).replace("{total}", String(runs.length))}
        </span>
      </div>

      {runs.length === 0 ? (
        <div className="empty-runs">
          <p>{t("noRuns")}</p>
          <button className="new-run-btn" type="button" onClick={onNew}>{t("newRun")}</button>
        </div>
      ) : filteredRuns.length === 0 ? (
        <div className="empty-runs">
          <p>{t("noMatchingRuns")}</p>
          <button className="runs-clear-filter" type="button" onClick={() => { setSearch(""); setStatusFilter("all"); }}>
            {t("clearFilters")}
          </button>
        </div>
      ) : (
        <div className="runs-list">
          {filteredRuns.map((run) => (
            <button key={run.id} type="button" className="run-card" onClick={() => onOpen(run.id)}>
              <span className={`history-dot ${statusFilterValue(run.status) === "completed" ? "green-dot" : statusFilterValue(run.status) === "failed" ? "red-dot" : "yellow-dot"}`} />
              <span className="run-card-copy">
                <strong>{run.prompt}</strong>
                <small>
                  {formatCreatedAt(run.createdAt, locale)}
                  <span aria-hidden="true"> · </span>
                  {run.tasks.length} {t("tasksCount")}
                </small>
              </span>
              <span className={`run-card-status ${run.status.toLowerCase().replaceAll(" ", "-")}`}>{statusLabel(run.status)}</span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
