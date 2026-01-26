import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const versionPath = path.join(root, "node-runtime-version.txt");
const version = (await fs.readFile(versionPath, "utf8")).trim();

const platformTag = (() => {
  if (process.platform === "win32") return "win";
  if (process.platform === "darwin") return "darwin";
  if (process.platform === "linux") return "linux";
  return null;
})();

const archTag = (() => {
  if (process.arch === "x64") return "x64";
  if (process.arch === "arm64") return "arm64";
  return null;
})();

if (!platformTag || !archTag) {
  throw new Error(`Unsupported platform/arch: ${process.platform}/${process.arch}`);
}

const ext = platformTag === "win" ? "zip" : "tar.xz";
const archiveName = `node-v${version}-${platformTag}-${archTag}.${ext}`;
const url = `https://nodejs.org/dist/v${version}/${archiveName}`;

const tmpDir = path.join(root, ".tmp_node");
const extractDir = path.join(tmpDir, "extract");
const archivePath = path.join(tmpDir, archiveName);

await fs.rm(tmpDir, { recursive: true, force: true });
await fs.mkdir(extractDir, { recursive: true });

console.log(`[bundle-node] Downloading ${url}`);
const res = await fetch(url);
if (!res.ok) {
  throw new Error(`[bundle-node] Download failed: HTTP ${res.status}`);
}

const file = await fs.open(archivePath, "w");
try {
  for await (const chunk of res.body) {
    await file.write(chunk);
  }
} finally {
  await file.close();
}

if (platformTag === "win") {
  console.log("[bundle-node] Extracting zip via PowerShell");
  const ps = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Expand-Archive -LiteralPath '${archivePath}' -DestinationPath '${extractDir}' -Force`,
    ],
    { stdio: "inherit" },
  );
  if (ps.status !== 0) {
    throw new Error(`[bundle-node] Expand-Archive failed with ${ps.status}`);
  }
} else {
  console.log("[bundle-node] Extracting tarball");
  const tar = spawnSync("tar", ["-xf", archivePath, "-C", extractDir], { stdio: "inherit" });
  if (tar.status !== 0) {
    throw new Error(`[bundle-node] tar failed with ${tar.status}`);
  }
}

const extractedRoot = path.join(extractDir, `node-v${version}-${platformTag}-${archTag}`);
const binaryName = platformTag === "win" ? "node.exe" : "node";
const binarySource =
  platformTag === "win"
    ? path.join(extractedRoot, binaryName)
    : path.join(extractedRoot, "bin", binaryName);

if (!existsSync(binarySource)) {
  throw new Error(`[bundle-node] Node binary missing at ${binarySource}`);
}

const resourceDir = path.join(root, "src-tauri", "resources", "node");
await fs.mkdir(resourceDir, { recursive: true });
const binaryTarget = path.join(resourceDir, binaryName);
await fs.copyFile(binarySource, binaryTarget);

if (platformTag !== "win") {
  await fs.chmod(binaryTarget, 0o755);
}

console.log(`[bundle-node] Node runtime ready at ${binaryTarget}`);
