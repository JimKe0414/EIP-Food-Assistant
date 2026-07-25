import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { delimiter, dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const args = new Set(process.argv.slice(2));
const useFocusIt = args.has("--focusit");
const foreground = args.has("--foreground");
const dryRun = args.has("--dry-run");
const knownArgs = new Set(["--focusit", "--foreground", "--dry-run"]);
const unknownArgs = [...args].filter((arg) => !knownArgs.has(arg));

if (unknownArgs.length > 0) {
  console.error(`[dev:https] Unknown option: ${unknownArgs.join(", ")}`);
  process.exit(1);
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer();

    server.unref();
    server.once("error", () => resolve(false));
    server.listen({ host: "0.0.0.0", port, exclusive: true }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function selectPort() {
  for (const port of [3000, 3003]) {
    if (await isPortAvailable(port)) return port;
  }

  throw new Error("Ports 3000 and 3003 are both in use. Stop one of them and retry.");
}

function resolveDockerCommand() {
  if (process.env.DOCKER_BIN) return process.env.DOCKER_BIN;

  const windowsDocker = "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe";
  if (process.platform === "win32" && existsSync(windowsDocker)) return windowsDocker;

  return "docker";
}

function addDockerToPath(environment, dockerCommand) {
  if (!isAbsolute(dockerCommand)) return;

  const pathKey = Object.keys(environment).find((key) => key.toLowerCase() === "path") ?? "PATH";
  environment[pathKey] = [dirname(dockerCommand), environment[pathKey]].filter(Boolean).join(delimiter);
}

function getRunningCaddyPort(dockerCommand, environment) {
  const result = spawnSync(
    dockerCommand,
    ["compose", "-f", "compose.yml", "port", "caddy", "443"],
    {
      cwd: projectRoot,
      env: environment,
      encoding: "utf8",
      windowsHide: true,
    },
  );

  if (result.status !== 0) return undefined;

  const match = result.stdout.trim().match(/:(\d+)$/);
  const port = match ? Number(match[1]) : undefined;
  return port === 3000 || port === 3003 ? port : undefined;
}

async function main() {
  const dockerCommand = resolveDockerCommand();
  const childEnv = { ...process.env };
  addDockerToPath(childEnv, dockerCommand);

  const port = getRunningCaddyPort(dockerCommand, childEnv) ?? await selectPort();
  const origin = `https://localhost:${port}`;
  const redirectUri = `${origin}/api/auth/google-callback`;
  const composeArgs = ["compose", "-f", "compose.yml"];

  if (useFocusIt) composeArgs.push("-f", "compose.focusit.yml");
  composeArgs.push("up", "--build");
  if (!foreground) composeArgs.push("-d");

  console.log(`[dev:https] Using ${origin}`);
  if (port === 3003) console.log("[dev:https] Port 3000 is occupied; switched to 3003.");
  console.log(`[dev:https] Google callback: ${redirectUri}`);

  if (dryRun) return;

  childEnv.WEB_PORT = String(port);
  childEnv.GOOGLE_REDIRECT_URI = redirectUri;

  const child = spawn(dockerCommand, composeArgs, {
    cwd: projectRoot,
    env: childEnv,
    stdio: "inherit",
  });

  child.once("error", (error) => {
    console.error(`[dev:https] Failed to start Docker Compose: ${error.message}`);
    process.exitCode = 1;
  });

  child.once("exit", (code, signal) => {
    if (signal) {
      console.error(`[dev:https] Docker Compose stopped by signal ${signal}.`);
      process.exitCode = 1;
      return;
    }

    process.exitCode = code ?? 1;
  });
}

main().catch((error) => {
  console.error(`[dev:https] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
