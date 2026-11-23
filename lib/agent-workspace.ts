import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { cp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

const execFile = promisify(execFileCallback);
const appRoot = process.cwd();
const allowedPatchPath = /^app\/(?!api\/)(?!layout\.tsx$)(?:[A-Za-z0-9_.()@-]+\/)*[A-Za-z0-9_.@-]+\.(?:tsx|css)$/;

export async function createWorkspace(runId: string) {
  const root = path.resolve(process.env.AGENT_WORKSPACE_ROOT || path.join(appRoot, ".agent-workspaces"));
  const directory = path.join(root, runId);
  await mkdir(root, { recursive: true, mode: 0o700 });
  await mkdir(directory, { recursive: false, mode: 0o700 });
  try {
    for (const name of ["app", "lib"]) {
      await cp(path.join(appRoot, name), path.join(directory, name), { recursive: true });
    }
    for (const name of ["package.json", "tsconfig.json", "next-env.d.ts", "next.config.js"]) {
      await cp(path.join(appRoot, name), path.join(directory, name));
    }
    await mkdir(path.join(directory, ".next", "types"), { recursive: true });
    await cp(path.join(appRoot, ".next", "types"), path.join(directory, ".next", "types"), { recursive: true }).catch(() => {});
    await symlink(path.join(appRoot, "node_modules"), path.join(directory, "node_modules"), "dir");
    await execFile("git", ["init", "-q", directory]);
    await execFile("git", ["-C", directory, "add", "app", "lib", "package.json", "tsconfig.json", "next-env.d.ts", "next.config.js"]);
    await execFile("git", ["-C", directory, "-c", "user.name=Crew Sandbox", "-c", "user.email=crew-sandbox@localhost", "commit", "-qm", "Isolated workspace baseline"]);
    return { root, directory };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export async function listWorkspaceFiles(directory: string) {
  const { stdout } = await execFile("find", ["app", "-type", "f", "!", "-path", "app/api/*", "!", "-name", "layout.tsx"], { cwd: directory });
  return stdout.split("\n").filter(Boolean).sort();
}

export async function readWorkspaceContext(directory: string, files: string[]) {
  const contents: string[] = [];
  let remaining = 22_000;
  for (const file of files.slice(0, 3)) {
    try {
      const text = await readFile(path.join(directory, file), "utf8");
      const content = text.slice(0, Math.min(remaining, 20_000));
      contents.push(`--- ${file} ---\n${content}${content.length < text.length ? "\n[archivo truncado por límite de contexto]" : ""}`);
      remaining -= content.length;
    } catch {
      contents.push(`--- ${file} ---\n[archivo nuevo; todavía no existe]`);
    }
  }
  return contents.join("\n\n");
}

export function validateTargetFiles(files: unknown) {
  if (!Array.isArray(files) || files.length < 1) throw new Error("El plan no indica archivos de trabajo.");
  const targets = files.slice(0, 3).map((file) => String(file));
  for (const file of targets) {
    if (!allowedPatchPath.test(file) || file.split("/").includes("..") || file.startsWith(".")) {
      throw new Error(`Archivo fuera del sandbox permitido: ${file}`);
    }
  }
  return [...new Set(targets)];
}

export function validatePatch(patch: string, allowedFiles: string[]) {
  if (!patch.trim() || patch.length > 120_000) throw new Error("Develop no devolvió un diff válido.");
  if (/^(?:new file mode 120000|old mode|new mode|rename from|rename to|GIT binary patch)/m.test(patch)) {
    throw new Error("El diff contiene cambios de modo o binarios no permitidos.");
  }
  const paths = [...patch.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm)].map((match) => [match[1], match[2]]);
  if (!paths.length) throw new Error("El diff no contiene archivos modificables.");
  const duplicates = paths.map(([, file]) => file).filter((file, index, files) => files.indexOf(file) !== index);
  if (duplicates.length) throw new Error(`El diff repite archivos: ${[...new Set(duplicates)].join(", ")}`);
  for (const [from, to] of paths) {
    if (from !== to || !allowedPatchPath.test(to) || to.split("/").includes("..") || !allowedFiles.includes(to)) {
      throw new Error(`Ruta fuera del sandbox permitido: ${to}`);
    }
  }
  return [...new Set(paths.map(([, to]) => to))];
}

export function normalizePatch(patch: string) {
  const cleaned = patch.trim().replace(/^```(?:diff|patch)?\s*\n/i, "").replace(/\n?```\s*$/, "");
  if (/^diff --git /m.test(cleaned)) return cleaned;
  const normalized = cleaned.replace(/^--- a\/(.+)$/m, (_, file: string) => `diff --git a/${file} b/${file}\n--- a/${file}`);
  if (normalized !== cleaned) return normalized;
  throw new Error(`Develop no devolvió un unified diff. Inicio recibido: ${cleaned.slice(0, 160)}`);
}

export async function applyPatch(directory: string, patch: string) {
  const patchPath = path.join(directory, ".crew-agent.patch");
  await writeFile(patchPath, patch, { mode: 0o600 });
  try {
    try {
      await execFile("git", ["-C", directory, "apply", "--check", patchPath], { timeout: 10_000 });
    } catch (error) {
      const paths = [...patch.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm)].map((match) => match[2]);
      const existing = [];
      for (const file of paths) {
        try {
          await readFile(path.join(directory, file));
          existing.push(file);
        } catch { /* Path does not exist yet. */ }
      }
      const detail = error instanceof Error ? error.message : "git apply check failed";
      throw new Error(`${detail}${existing.length ? `; ya existe(n): ${existing.join(", ")}` : "; ningún destino existe en el sandbox"}`);
    }
    await execFile("git", ["-C", directory, "apply", patchPath], { timeout: 10_000 });
    await execFile("git", ["-C", directory, "add", "-N", "--", ...validatePatch(patch, await listWorkspaceFiles(directory))], { timeout: 10_000 });
  } finally {
    await rm(patchPath, { force: true });
  }
}

export async function typecheckWorkspace(directory: string) {
  const compiler = path.join(appRoot, "node_modules", "typescript", "bin", "tsc");
  try {
    const { stdout, stderr } = await execFile(process.execPath, [compiler, "--noEmit", "--pretty", "false", "--project", "tsconfig.json"], {
      cwd: directory,
      timeout: 45_000,
      maxBuffer: 256 * 1024,
    });
    return { passed: true, output: [stdout, stderr].filter(Boolean).join("\n").trim() || "tsc --noEmit: sin errores." };
  } catch (error) {
    const result = error as { stdout?: string; stderr?: string; message?: string };
    return { passed: false, output: [result.stdout, result.stderr, result.message].filter(Boolean).join("\n").slice(0, 12_000) };
  }
}

export async function getWorkspaceDiff(directory: string) {
  const { stdout } = await execFile("git", ["-C", directory, "diff", "--no-ext-diff", "--", "app"]);
  return stdout;
}

export async function removeWorkspace(directory: string) {
  await rm(directory, { recursive: true, force: true });
}
