import { spawn } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 4173);
const GROK_BIN = process.env.GROK_BIN || "grok";
const GROK_MODEL = process.env.GROK_MODEL || "grok-4.5";
const MAX_BODY_BYTES = 16_384;
const MAX_PROMPT_CHARS = 6_000;
const TIMEOUT_MS = 90_000;

const RESPONSE_SCHEMA = JSON.stringify({
  type: "object",
  additionalProperties: false,
  properties: {
    situation: { type: "string" },
    timing: { type: "string" },
    actions: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: { type: "string" },
    },
    warning: { type: "string" },
  },
  required: ["situation", "timing", "actions", "warning"],
});

const SYSTEM_PROMPT = [
  "你是精通《周易》义理、克制且务实的现代决策顾问。",
  "只依据用户提供的卦象材料，不虚构未提供的经文原句，不作宿命化预测。",
  "把卦象当作审视处境与选择的框架，不声称能确定未来。",
  "解读必须紧扣具体问题，给出清晰、现实、可执行的建议。",
].join("");

function cleanCliError(stderr) {
  const lines = String(stderr)
    .replace(/\u001b\[[0-9;]*m/g, "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const lastError = [...lines].reverse().find(line => /^(error|fatal):/i.test(line));
  return (lastError || lines.at(-1) || "Grok 调用失败").replace(/^error:\s*/i, "");
}

function jsonResponse(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
  });
  res.end(payload);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("请求内容过大");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function runGrok(prompt, { grokBin, grokModel, grokCwd }) {
  const args = [
    "--single", prompt,
    "--model", grokModel,
    "--reasoning-effort", "low",
    "--system-prompt-override", SYSTEM_PROMPT,
    "--json-schema", RESPONSE_SCHEMA,
    "--max-turns", "3",
    "--no-memory",
    "--no-subagents",
    "--no-plan",
    "--disable-web-search",
    "--verbatim",
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(grokBin, args, {
      cwd: grokCwd,
      env: { ...process.env, NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Grok 响应超时"));
    }, TIMEOUT_MS);

    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", error => {
      clearTimeout(timer);
      const message = error.code === "ENOENT"
        ? "未检测到 Grok CLI，请先安装并登录，或在 AI 设置中选择云端模型"
        : error.message;
      reject(new Error(message));
    });
    child.on("close", code => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr.trim() ? cleanCliError(stderr) : `Grok 退出码 ${code}`));
        return;
      }
      try {
        const envelope = JSON.parse(stdout);
        const interpretation = envelope.structuredOutput || JSON.parse(envelope.text);
        resolve({ interpretation, usage: envelope.usage || null });
      } catch {
        reject(new Error("Grok 返回了无法解析的结构"));
      }
    });
  });
}

function serveStatic(req, res, root) {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath);
  if (!filePath.startsWith(root) || !existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
  }[extname(filePath)] || "application/octet-stream";
  res.writeHead(200, { "content-type": mime, "cache-control": "no-store" });
  createReadStream(filePath).pipe(res);
}

export function startServer({
  host = HOST,
  port = PORT,
  root = ROOT,
  grokBin = GROK_BIN,
  grokModel = GROK_MODEL,
  grokCwd = root,
} = {}) {
  let activeRequest = false;
  const server = createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/api/health") {
      jsonResponse(res, 200, { ok: true, provider: "grok-cli", model: grokModel });
      return;
    }

    if (req.method === "POST" && req.url === "/api/interpret") {
      if (activeRequest) {
        jsonResponse(res, 429, { error: "已有一条解读正在推演，请稍后再试" });
        return;
      }
      activeRequest = true;
      try {
        const body = await readJson(req);
        const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
        if (!prompt || prompt.length > MAX_PROMPT_CHARS) {
          jsonResponse(res, 400, { error: "解读材料为空或过长" });
          return;
        }
        const startedAt = Date.now();
        const result = await runGrok(prompt, { grokBin, grokModel, grokCwd });
        jsonResponse(res, 200, {
          ...result,
          provider: "grok-cli",
          model: grokModel,
          durationMs: Date.now() - startedAt,
        });
      } catch (error) {
        jsonResponse(res, 502, { error: error.message || "Grok 调用失败" });
      } finally {
        activeRequest = false;
      }
      return;
    }

    if (req.method === "GET" || req.method === "HEAD") {
      serveStatic(req, res, root);
      return;
    }
    res.writeHead(405, { allow: "GET, HEAD, POST" });
    res.end("Method not allowed");
  });

  return new Promise((resolveStart, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      const address = server.address();
      const activePort = typeof address === "object" && address ? address.port : port;
      resolveStart({ server, url: `http://${host}:${activePort}`, port: activePort });
    });
  });
}

const isDirect = process.argv[1]
  && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);

if (isDirect) {
  startServer().then(({ url }) => {
    console.log(`周易观卦本地测试：${url}`);
    console.log(`AI 服务：Grok CLI / ${GROK_MODEL}`);
  }).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
