"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  Activity, ArrowDown, ArrowUpRight, Bot, Check, CheckCheck, ChevronDown, Circle,
  Code2, Command, Eye, EyeOff, FlaskConical, GitBranch, Layers3,
  LoaderCircle, Menu, Plus, Sparkles,
  Workflow, X, ChevronRight,
} from "lucide-react";
import { messages, type Locale, type MessageKey } from "@/lib/translations";
import { AccountMenu } from "@/components/account-menu";
import { fetchCurrentSession } from "@/features/auth/services/session-client";
import { backendApiUrl, backendFetch } from "@/lib/backend-api";

type Status = "done" | "active" | "queued" | "failed";
type Task = { id: string; title: string; agent: "Develop" | "Testing" | "Orchestrator"; status: Status; detail: string; time: string };
type RunResult = { summary?: string; plan?: string[]; diff?: string; testOutput?: string; review?: string; iterations?: number; changedFiles?: string[]; passed?: boolean; error?: string };
type Run = { id: string; prompt: string; createdAt: string; status: string; tasks: Task[]; result?: RunResult };
type AppUser = { id: string; email: string };

const agents = [
  { name: "Orchestrator", role: "orchestratorRole", Icon: Workflow, color: "violet" },
  { name: "Develop", role: "developRole", Icon: Code2, color: "blue" },
  { name: "Testing", role: "testingRole", Icon: FlaskConical, color: "green" },
];

function timeNow() { return new Date().toLocaleTimeString("es-ES", { hour12: false }); }

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [runs, setRuns] = useState<Run[]>([]);
  const [currentId, setCurrentId] = useState("demo");
  const [busy, setBusy] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeView, setActiveView] = useState<"activity" | "runs">("activity");
  const [user, setUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [locale, setLocale] = useState<Locale>("en");
  const t = (key: MessageKey) => messages[locale][key];
  const current = runs.find((r) => r.id === currentId);
  const tasks = current?.tasks ?? [];
  const completedTasks = runs.reduce((total, run) => total + run.tasks.filter((task) => task.status === "done").length, 0);
  const statusLabel = (status: string) => ({
    "Completado": t("completed"), "Completed": t("completed"),
    "En curso": t("inProgress"), "In progress": t("inProgress"),
    "Fallida": t("failed"), "Failed": t("failed"),
    "En cola": t("queued"), "Queued": t("queued"),
  }[status] || status);
  const taskTitle = (task: Task) => {
    if (task.id === "orchestrator") return t("orchestratorTask");
    if (task.id === "develop") return t("developTask");
    if (task.id === "testing") return t("testingTask");
    return task.title;
  };
  useEffect(() => {
    const savedTheme = localStorage.getItem("crew-theme");
    const savedLocale = localStorage.getItem("crew-locale");
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
    document.documentElement.dataset.theme = savedTheme === "light" ? "light" : "dark";
    const initialLocale = savedLocale === "en" || savedLocale === "es"
      ? savedLocale
      : navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
    setLocale(initialLocale);
    document.documentElement.lang = initialLocale;
  }, []);

  useEffect(() => {
    fetchCurrentSession().then((response) => response.json()).then((data) => setUser(data.user))
      .catch(() => setAuthMessage(messages[locale].networkError))
      .finally(() => setAuthReady(true));
  }, [locale]);

  useEffect(() => {
    if (!authReady || !user) return;
    let cancelled = false;
    backendFetch("runs").then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar las ejecuciones.");
      return data;
    }).then((data) => {
      if (cancelled) return;
      const loaded = data.runs as Run[];
      setRuns(loaded);
      setCurrentId(loaded[0]?.id ?? "demo");
    }).catch((error) => { if (!cancelled) setAuthMessage(error.message); });
    return () => { cancelled = true; };
  }, [authReady, user]);

  async function saveRun(run: Run) {
    const response = await backendFetch("runs", {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify(run),
    });
    if (!response.ok) {
      const data = await response.json();
      setAuthMessage(data.error || "No se pudo guardar la ejecución.");
    }
  }
  function persist(next: Run[]) {
    setRuns(next);
    if (next[0]) void saveRun(next[0]);
  }
  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true); setAuthMessage("");
    try {
      const response = await backendFetch("auth/login", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAuthMessage(typeof data.error === "string"
          ? data.error
          : response.status === 401 ? t("invalidCredentials") : t("authFailed"));
        return;
      }
      setUser(data.user); setPassword(""); setAuthMessage("");
    } catch {
      setAuthMessage(t("networkError"));
    } finally {
      setAuthBusy(false);
    }
  }
  async function logout() {
    await backendFetch("auth/logout", { method: "POST" });
    setUser(null); setRuns([]); setCurrentId("demo");
  }

  async function runTeam(text = prompt) {
    const value = text.trim();
    if (!value || busy) return;
    const id = crypto.randomUUID();
    const initial: Run = {
      id, prompt: value, createdAt: timeNow(), status: "En curso",
      result: {},
      tasks: [
        { id: "orchestrator", title: t("orchestratorTask"), agent: "Orchestrator", status: "active", detail: t("waitingForOrchestrator"), time: timeNow() },
        { id: "develop", title: t("developTask"), agent: "Develop", status: "queued", detail: t("waitingForPlan"), time: "—" },
        { id: "testing", title: t("testingTask"), agent: "Testing", status: "queued", detail: t("waitingForDevelop"), time: "—" },
      ],
    };
    setPrompt(""); setCurrentId(id); setBusy(true); persist([initial, ...runs]);
    await saveRun(initial);
    let polling = true;
    const pollRuns = async () => {
      while (polling) {
        try {
          const response = await backendFetch("runs");
          if (response.ok) {
            const data = await response.json();
            const found = (data.runs as Run[]).find((run) => run.id === id);
            if (found) setRuns((old) => old.map((run) => run.id === id ? found : run));
          }
        } catch { /* The final response below reports connection failures. */ }
        await new Promise((resolve) => setTimeout(resolve, 900));
      }
    };
    const poller = pollRuns();
    try {
      const response = await backendFetch("agents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ runId: id, locale }) });
      const agentResult = await response.json();
      if (!response.ok) throw new Error(agentResult.error || "No se pudo completar la ejecución");
      const finalResponse = await backendFetch("runs");
      if (finalResponse.ok) {
        const data = await finalResponse.json();
        const found = (data.runs as Run[]).find((run) => run.id === id);
        if (found) setRuns((old) => old.map((run) => run.id === id ? found : run));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t("networkError");
      setAuthMessage(message);
      const failed: Run = { ...initial, status: "Fallida", tasks: initial.tasks.map((task) => task.id === "orchestrator" ? task : { ...task, status: "failed", detail: message, time: timeNow() }) };
      setRuns((old) => old.map((run) => run.id === id ? failed : run));
      await saveRun(failed);
    } finally {
      polling = false;
      await poller;
      setBusy(false);
    }
  }

  function newRun() {
    setActiveView("activity");
    setCurrentId("demo");
    setPrompt("");
    setMobileOpen(false);
  }
  function openRun(id: string) {
    setCurrentId(id);
    setActiveView("activity");
    setMobileOpen(false);
  }
  function changeTheme(nextTheme: "dark" | "light") {
    setTheme(nextTheme);
    localStorage.setItem("crew-theme", nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }
  function changeLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    localStorage.setItem("crew-locale", nextLocale);
    document.documentElement.lang = nextLocale;
  }
  if (!authReady) return <main className="auth-loading"><div className="brand-mark"><Layers3 size={18} /></div><span>{t("loading")}</span></main>;
  if (!user) return (
    <main className="auth-shell">
      <div className="auth-brand"><div className="brand-mark"><Layers3 size={18} /></div><span>crew<span className="brand-dot">.</span></span></div>
      <div className="auth-controls" role="group" aria-label={t("language")}>
        <button type="button" className={locale === "en" ? "auth-locale selected" : "auth-locale"} onClick={() => changeLocale("en")} aria-pressed={locale === "en"}>EN</button>
        <button type="button" className={locale === "es" ? "auth-locale selected" : "auth-locale"} onClick={() => changeLocale("es")} aria-pressed={locale === "es"}>ES</button>
      </div>
      <section className="auth-card">
        <div className="auth-icon"><Bot size={20} /></div>
        <div className="eyebrow"><span className="eyebrow-line" /> {t("workspace").toUpperCase()}</div>
        <h1>{t("signInTitle")}</h1>
        <p className="auth-description">{t("signInDescription")}</p>
        <form className="auth-form" onSubmit={submitAuth}>
          <label htmlFor="auth-email">{t("email")}</label>
          <input id="auth-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
          <label htmlFor="auth-password">{t("password")}</label>
          <div className="password-field">
            <input id="auth-password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("passwordPlaceholder")} />
            <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? t("hidePassword") : t("showPassword")} aria-pressed={showPassword} title={showPassword ? t("hidePassword") : t("showPassword")}>
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <label className="remember-option"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />{t("rememberMe")}</label>
          {authMessage && <div className="auth-message" role="status">{authMessage}</div>}
          <button className="auth-submit" disabled={authBusy} type="submit">{authBusy ? <LoaderCircle size={15} className="spin" /> : null}{authBusy ? t("signingIn") : t("signIn")} <ArrowUpRight size={15} /></button>
        </form>
        <p className="registration-disabled">{t("registrationDisabled")}</p>
        <div className="auth-secure"><span className="tiny-live" /> {t("secureSession")}</div>
      </section>
      <div className="auth-footer">CREW WORKSPACE <span>·</span> {t("secureSession").toUpperCase()}</div>
    </main>
  );
  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand"><div className="brand-mark"><Layers3 size={18} strokeWidth={2.3} /></div><span>crew<span className="brand-dot">.</span></span><button className="icon-btn mobile-close" onClick={() => setMobileOpen(false)} aria-label={t("workspace")}><X size={17} /></button></div>
        <div className="workspace"><span className="workspace-avatar">C</span><span className="workspace-name">{t("workspaceName")}<small>{t("freePlan")}</small></span></div>
        <div className="side-label">{t("workspace").toUpperCase()}</div>
        <nav className="nav">
          <button type="button" className={`nav-item ${activeView === "activity" ? "active" : ""}`} aria-current={activeView === "activity" ? "page" : undefined} onClick={() => { setActiveView("activity"); setMobileOpen(false); }}><Activity size={16} /> {t("activity")} <span className="nav-count">{runs.length}</span></button>
          <button type="button" className={`nav-item ${activeView === "runs" ? "active" : ""}`} aria-current={activeView === "runs" ? "page" : undefined} onClick={() => { setActiveView("runs"); setMobileOpen(false); }}><Workflow size={16} /> {t("agentRuns")}</button>
          <button className="nav-item" disabled><GitBranch size={16} /> {t("integrations")} <span className="soon">{t("soon")}</span></button>
        </nav>
        <div className="side-label recent-label">{t("recentRuns")} <button onClick={newRun} aria-label={t("newRun")}><Plus size={14} /></button></div>
        <div className="history">
          {runs.length === 0 ? <div className="empty-history">{t("noRuns")}</div> : runs.map((run) => (
            <button key={run.id} className={`history-item ${currentId === run.id ? "selected" : ""}`} onClick={() => openRun(run.id)}>
              <span className={`history-dot ${["Completado", "Completed"].includes(run.status) ? "green-dot" : "yellow-dot"}`} /><span>{run.prompt}</span>
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="usage"><div className="usage-top"><span>{t("savedRuns")}</span><span>{runs.length}</span></div><div className="usage-track"><span style={{ width: `${Math.min(runs.length * 8, 100)}%` }} /></div></div>
          <div className="sidebar-account">
            <AccountMenu
              email={user.email}
              locale={locale}
              theme={theme}
              trigger="sidebar"
              t={t}
              onThemeChange={changeTheme}
              onLocaleChange={changeLocale}
              onLogout={logout}
            />
          </div>
        </div>
      </aside>
      {mobileOpen && <button aria-label={t("workspace")} className="scrim" onClick={() => setMobileOpen(false)} />}
      <section className="main-area">
        <header className="topbar">
          <div className="crumb"><button className="icon-btn menu-trigger" onClick={() => setMobileOpen(true)} aria-label={t("workspace")}><Menu size={18} /></button><span>{t("workspace")}</span><span className="crumb-slash">/</span><strong>{activeView === "runs" ? t("agentRuns") : t("activity")}</strong></div>
          <div className="top-actions">
            <span className="live-pill"><span /> {t("workspaceReady")}</span>
            <AccountMenu
              email={user.email}
              locale={locale}
              theme={theme}
              trigger="header"
              t={t}
              onThemeChange={changeTheme}
              onLocaleChange={changeLocale}
              onLogout={logout}
            />
          </div>
        </header>
        <div className="content">
          {activeView === "runs" ? (
            <section aria-labelledby="runs-heading">
              <div className="page-heading">
                <div>
                  <div className="eyebrow"><span className="eyebrow-line" /> {t("workspace").toUpperCase()}</div>
                  <h1 id="runs-heading">{t("agentRuns")}</h1>
                  <p>{t("runsDescription")}</p>
                </div>
                <button className="new-run-btn" type="button" onClick={newRun}><Plus size={16} /> {t("newRun")}</button>
              </div>
              {runs.length === 0 ? (
                <div className="empty-runs">
                  <p>{t("noRuns")}</p>
                  <button className="new-run-btn" type="button" onClick={newRun}><Plus size={16} /> {t("newRun")}</button>
                </div>
              ) : (
                <div className="runs-list">
                  {runs.map((run) => (
                    <button
                      key={run.id}
                      type="button"
                      className="run-card"
                      onClick={() => openRun(run.id)}
                    >
                      <span className={`history-dot ${["Completado", "Completed"].includes(run.status) ? "green-dot" : "yellow-dot"}`} />
                      <span className="run-card-copy">
                        <strong>{run.prompt}</strong>
                        <small>{run.tasks.length} {t("tasksCount")}</small>
                      </span>
                      <span className={`run-card-status ${run.status.toLowerCase().replaceAll(" ", "-")}`}>{statusLabel(run.status)}</span>
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <>
          <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> {t("aiTeam")}</div><h1>{t("headingStart")} <span>{t("headingAccent")}</span></h1><p>{t("headingDescription")}</p></div><button className="new-run-btn" onClick={newRun}><Plus size={16} /> {t("newRun")} <span className="shortcut">⌘ K</span></button></div>
          <div className="stats-row">
            <div className="stat-card"><div className="stat-label">{t("agentsAvailable").toUpperCase()} <span className="stat-icon violet"><Bot size={15} /></span></div><div className="stat-value">{agents.length.toString().padStart(2, "0")} <small>{t("agentsAvailable")}</small></div><div className="stat-foot"><span className="tiny-live" /> {t("workspaceReady")}</div></div>
            <div className="stat-card"><div className="stat-label">{t("tasksCompleted")} <span className="stat-icon green"><CheckCheck size={15} /></span></div><div className="stat-value">{completedTasks} <small>{t("acrossRuns")}</small></div><div className="stat-foot">{t("taskActivityDescription")}</div></div>
            <div className="stat-card"><div className="stat-label">{t("savedRuns")} <span className="stat-icon blue"><Activity size={15} /></span></div><div className="stat-value">{runs.length} <small>{t("inWorkspace")}</small></div><div className="stat-foot">{t("workspaceReady")}</div></div>
          </div>
          <div className="section-heading"><div><h2>{t("workflow")}</h2><p>{t("workflowDescription")}</p></div>{current && <span className="run-badge"><span /> {statusLabel(current.status)}</span>}</div>
          <div className="workflow-card">
            <div className="workflow-top"><div className="workflow-title"><div className="workflow-icon"><Sparkles size={17} /></div><div><strong>{t("teamTitle")}</strong><span>{t("teamDescription")}</span></div></div></div>
            <div className="agents">
              {agents.map(({ name, role, Icon, color }, i) => {
                const liveTask = tasks.find((task) => task.agent === name && (task.status === "active" || task.status === "failed"));
                const state = liveTask?.status === "active" ? t("inProgress") : liveTask?.status === "failed" ? t("failed") : t("ready");
                return <div className="agent-wrap" key={name}><div className="agent-card"><div className={`agent-avatar ${color}`}><Icon size={19} /></div><div className="agent-info"><strong>{name}</strong><span>{t(role as MessageKey)}</span></div><div className={`agent-state ${liveTask?.status ? `agent-state-${liveTask.status}` : ""}`}><span className="tiny-live" /> {state}</div></div>{i < 2 && <div className="agent-connector"><span /><ArrowUpRight size={14} /></div>}</div>;
              })}
            </div>
            <div className="workflow-foot"><span><span className="tiny-live" /> {agents.length} {t("agentsOnline")}</span><span className="foot-separator">·</span><span>{t("sequentialOrchestration")}</span><span className="workflow-version">{t("engine")} <span>v1.0</span></span></div>
          </div>
          <div className="tasks-header"><div><h2>{t("taskActivity")}</h2><p>{t("taskActivityDescription")}</p></div><span className="filter-btn">{t("allTasks")} <ChevronDown size={14} /></span></div>
          <div className="task-list">
            {tasks.length === 0 ? <div className="empty-tasks">{t("noRuns")}</div> : tasks.map((task) => {
              const color = task.agent === "Orchestrator" ? "violet" : task.agent === "Develop" ? "blue" : "green";
              const Icon = task.agent === "Orchestrator" ? Workflow : task.agent === "Develop" ? Code2 : FlaskConical;
              return <div className="task-row" key={task.id}><div className={`task-status ${task.status}`}>{task.status === "done" ? <Check size={13} /> : task.status === "active" ? <LoaderCircle size={14} className="spin" /> : task.status === "failed" ? <X size={13} /> : <Circle size={12} />}</div><div className="task-main"><div className="task-title">{taskTitle(task)}</div><div className="task-detail">{task.detail}</div></div><span className={`agent-tag ${color}`}><Icon size={12} /> {task.agent}</span><span className={`status-tag ${task.status}`}>{task.status === "done" ? t("completed") : task.status === "active" ? t("inProgress") : task.status === "failed" ? t("failed") : t("queued")}</span><span className="task-time">{task.time}</span></div>;
            })}
          </div>
          {current?.result?.diff && <section className={`agent-result ${current.result.passed ? "passed" : "not-passed"}`}>
            <div className="result-heading"><div><strong>{current.result.passed ? t("approvedChanges") : t("changesNeedReview")}</strong><span>{t("isolatedSandbox")}</span></div><a className="download-patch" href={backendApiUrl(`runs/${current.id}/patch`)}>{t("downloadPatch")} <ArrowDown size={13} /></a></div>
            {current.result.plan?.length ? <ul className="result-plan">{current.result.plan.map((item, i) => <li key={`${i}-${item}`}>{item}</li>)}</ul> : null}
            {current.result.review && <p className="result-review">{current.result.review}</p>}
            {current.result.testOutput && <details className="result-tests"><summary>{t("testingResult")} · {current.result.iterations ?? 1} {(current.result.iterations ?? 1) === 1 ? t("round") : t("rounds")}</summary><pre>{current.result.testOutput}</pre></details>}
            <details className="result-diff"><summary>{t("viewChanges")} ({current.result.changedFiles?.length ?? 0})</summary><pre>{current.result.diff}</pre></details>
          </section>}
          <div className="composer-wrap"><div className="composer"><div className="composer-spark"><Sparkles size={16} /></div><textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runTeam(); } }} placeholder={t("composerPlaceholder")} rows={1} /><button className="attach-btn" title={t("addContext")}><Plus size={17} /></button><button className="send-btn" disabled={!prompt.trim() || busy} onClick={() => runTeam()} aria-label={t("sendRequest")}>{busy ? <LoaderCircle size={16} className="spin" /> : <ArrowUpRight size={17} />}</button></div><div className="composer-hint"><span><Command size={11} /> {t("enterToSend")} <span className="hint-divider">·</span> {t("shiftEnterNewLine")}</span><span><span className="hint-green" /> {t("agentsReady")}</span></div></div>
            </>
          )}
        </div>
        <footer className="page-footer"><span>{t("footerTagline")}</span><span><span className="footer-link">{t("docs")} <ArrowUpRight size={11} /></span><span className="footer-sep">·</span><span className="footer-link">{t("feedback")} <ArrowUpRight size={11} /></span><span className="footer-sep">·</span> {t("copyright")}</span></footer>
      </section>
    </main>
  );
}
