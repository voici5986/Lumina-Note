import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const DEFAULT_PORT = 4173;
const DEFAULT_HOST = "127.0.0.1";

function findEdgeExecutablePath() {
  const candidates = new Set();

  const addCandidate = (p) => {
    if (p && p.trim().length > 0) candidates.add(p.trim());
  };

  const programRoots = [
    process.env.ProgramW6432,
    process.env.PROGRAMFILES,
    process.env["PROGRAMFILES(X86)"],
    process.env.LOCALAPPDATA,
    process.env.USERPROFILE,
  ].filter(Boolean);

  for (const root of programRoots) {
    addCandidate(path.join(root, "Microsoft", "Edge", "Application", "msedge.exe"));
  }

  if (process.env.USERPROFILE) {
    addCandidate(
      path.join(
        process.env.USERPROFILE,
        "AppData",
        "Local",
        "Microsoft",
        "Edge",
        "Application",
        "msedge.exe",
      ),
    );
  }

  addCandidate("C:\\\\Program Files (x86)\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe");
  addCandidate("C:\\\\Program Files\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe");

  if (process.platform === "win32") {
    const where = spawnSync("where", ["msedge"], { encoding: "utf8" });
    if (where.status === 0 && where.stdout) {
      for (const line of where.stdout.split(/\r?\n/)) {
        addCandidate(line);
      }
    }
  }

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      // ignore
    }
  }
  return null;
}

function parseArgs(argv) {
  const args = [...argv];
  if (args.length < 2) {
    throw new Error(
      "Usage: node scripts/typesetting_export_harness.mjs <docx> <output.pdf> [--baseline <baseline.pdf>] [--port <port>] [--no-server]",
    );
  }
  const docxPath = args.shift();
  const outPdf = args.shift();
  const options = {
    baseline: null,
    port: DEFAULT_PORT,
    noServer: false,
  };

  while (args.length > 0) {
    const flag = args.shift();
    switch (flag) {
      case "--baseline":
        options.baseline = args.shift() ?? null;
        break;
      case "--port":
        options.port = Number(args.shift() ?? DEFAULT_PORT);
        break;
      case "--no-server":
        options.noServer = true;
        break;
      default:
        throw new Error(`Unknown option: ${flag}`);
    }
  }

  return { docxPath, outPdf, options };
}

async function waitForServer(origin, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(origin, { method: "GET" });
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Dev server did not respond at ${origin}`);
}

function spawnDevServer(port) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  return spawn(npm, ["run", "dev", "--", "--host", DEFAULT_HOST, "--port", String(port)], {
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
}

function runDiff(baseline, candidate) {
  const node = process.execPath ?? "node";
  return new Promise((resolve, reject) => {
    const proc = spawn(
      node,
      ["scripts/typesetting_pdf_diff.mjs", baseline, candidate],
      { stdio: "inherit" },
    );
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pdf diff failed (code=${code})`));
    });
  });
}

async function main() {
  const { docxPath, outPdf, options } = parseArgs(process.argv.slice(2));
  const edge = findEdgeExecutablePath();
  if (!edge) {
    throw new Error("Microsoft Edge not found.");
  }

  const absoluteDocx = path.resolve(docxPath);
  const absolutePdf = path.resolve(outPdf);
  const origin = `http://${DEFAULT_HOST}:${options.port}`;
  let server = null;

  if (!options.noServer) {
    server = spawnDevServer(options.port);
  }

  try {
    if (!options.noServer) {
      await waitForServer(origin, 60_000);
    }

    const browser = await chromium.launch({
      headless: true,
      executablePath: edge,
    });
    const page = await browser.newPage();
    page.on("console", (msg) => {
      console.log(`[page:${msg.type()}] ${msg.text()}`);
    });
    page.on("pageerror", (err) => {
      console.error("[page:error]", err);
    });

    const harnessUrl = `${origin}/?typesettingHarness=1`;
    await page.goto(harnessUrl, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__luminaTypesettingHarness, { timeout: 60_000 });

    const base64 = fs.readFileSync(absoluteDocx).toString("base64");
    await page.evaluate(
      async ({ payload, name }) => {
        await window.__luminaTypesettingHarness.loadDocxBase64(payload, name);
      },
      { payload: base64, name: path.basename(absoluteDocx) },
    );

    const readyDeadline = Date.now() + 120_000;
    let ready = false;
    let lastLog = 0;
    while (Date.now() < readyDeadline) {
      const status = await page.evaluate(() => window.__luminaTypesettingStatus ?? null);
      ready = Boolean(status?.ready);
      if (ready) {
        break;
      }
      const now = Date.now();
      if (now - lastLog > 5000) {
        console.log("Waiting for typesetting harness...", status);
        lastLog = now;
      }
      await page.waitForTimeout(1000);
    }
    if (!ready) {
      const status = await page.evaluate(() => window.__luminaTypesettingStatus ?? null);
      throw new Error(`Typesetting harness not ready: ${JSON.stringify(status)}`);
    }

    const pdfBase64 = await page.evaluate(async () => {
      return window.__luminaTypesettingHarness.exportPdfBase64();
    });

    fs.mkdirSync(path.dirname(absolutePdf), { recursive: true });
    fs.writeFileSync(absolutePdf, Buffer.from(pdfBase64, "base64"));

    await browser.close();

    if (options.baseline) {
      await runDiff(path.resolve(options.baseline), absolutePdf);
    }
  } finally {
    if (server) {
      if (process.platform === "win32" && server.pid) {
        spawn("taskkill", ["/PID", String(server.pid), "/T", "/F"], {
          stdio: "ignore",
        });
      } else {
        server.kill();
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
