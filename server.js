// suuu — local bridge server. Zero dependencies.
// Website <-> Claude Code CLI (your subscription, no API key)
// or <-> Anthropic API (optional key mode).
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

const PORT = process.env.PORT || 5151;
const PUBLIC = path.join(__dirname, "public");
const SOUL_PATH = path.join(os.homedir(), ".claude", "agents", "suuu.md");

const FALLBACK_SOUL = `You are suuu — Subha's mentor-bro agent: honest before nice,
creative ("how did they even do that?" bar), protective (school till boards,
burnout watch). Talk bro-to-bro, terse and alive.`;

function loadSoul() {
  try {
    let raw = fs.readFileSync(SOUL_PATH, "utf8");
    // strip frontmatter
    if (raw.startsWith("---")) {
      const end = raw.indexOf("\n---", 3);
      if (end !== -1) raw = raw.slice(end + 4);
    }
    return raw.trim();
  } catch {
    return FALLBACK_SOUL;
  }
}

const WEB_CONTEXT = `

=== LIVE WEBSITE SESSION ===
You are speaking through your live website (the "suuu is awake" chat).
Reply as suuu in plain conversational text — tight, alive, bro-to-bro.
No markdown headers or bullet walls unless genuinely useful.
Only read memory/files if the question actually needs them; casual chat
should answer instantly from what you already know above.`;

function buildPrompt(messages) {
  const soul = loadSoul();
  const transcript = messages
    .slice(-24)
    .map((m) => (m.role === "user" ? "Subha: " : "suuu: ") + m.content)
    .join("\n\n");
  return `${soul}${WEB_CONTEXT}\n\nConversation so far:\n\n${transcript}\n\nReply as suuu:`;
}

// ---- mode 1: Claude Code CLI (no API key — uses your login) ----
function chatViaCli(messages) {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["-p", "--output-format", "text"], {
      shell: true,
      windowsHide: true,
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("suuu took too long (120s). Try again."));
    }, 120000);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && out.trim()) resolve(out.trim());
      else reject(new Error(err.trim() || `claude CLI exited ${code}`));
    });
    child.stdin.write(buildPrompt(messages));
    child.stdin.end();
  });
}

// ---- mode 2: Anthropic API (optional key) ----
async function chatViaApi(messages, apiKey, model) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: model || "claude-opus-4-8",
      max_tokens: 1500,
      system: loadSoul() + WEB_CONTEXT,
      messages: messages.slice(-24).map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      })),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `API ${res.status}`);
  return data.content.map((b) => b.text || "").join("");
}

function detectCli() {
  return new Promise((resolve) => {
    const child = spawn("claude", ["--version"], { shell: true, windowsHide: true });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.on("error", () => resolve(null));
    child.on("close", (code) => resolve(code === 0 ? out.trim() : null));
  });
}

// CORS: lets the hosted site (suuu-three.vercel.app) use this local bridge
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

function json(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", ...CORS });
  res.end(JSON.stringify(obj));
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");

  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    return res.end();
  }

  if (req.method === "GET" && url.pathname === "/api/status") {
    const v = await detectCli();
    return json(res, 200, {
      cli: !!v,
      version: v,
      soul: fs.existsSync(SOUL_PATH),
    });
  }

  if (req.method === "POST" && url.pathname === "/api/chat") {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", async () => {
      try {
        const { messages, apiKey, model } = JSON.parse(body);
        if (!Array.isArray(messages) || !messages.length)
          return json(res, 400, { error: "no messages" });
        const reply = apiKey
          ? await chatViaApi(messages, apiKey, model)
          : await chatViaCli(messages);
        json(res, 200, { reply });
      } catch (e) {
        json(res, 500, { error: e.message });
      }
    });
    return;
  }

  // static
  let file = url.pathname === "/" ? "/index.html" : url.pathname;
  file = path.normalize(file).replace(/^(\.\.[/\\])+/, "");
  const full = path.join(PUBLIC, file);
  if (!full.startsWith(PUBLIC)) return json(res, 403, { error: "no" });
  fs.readFile(full, (err, data) => {
    if (err) return json(res, 404, { error: "not found" });
    res.writeHead(200, { "content-type": MIME[path.extname(full)] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  suuu is listening  →  http://localhost:${PORT}\n`);
  console.log(`  soul: ${fs.existsSync(SOUL_PATH) ? SOUL_PATH : "fallback (agents/suuu.md not found)"}`);
});
