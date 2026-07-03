// Vercel serverless chat — API-key mode only (the keyless CLI bridge is
// local-only; Vercel has no Claude Code login).
const SOUL = require("./_soul.js");

const WEB_CONTEXT = `

=== LIVE WEBSITE SESSION ===
You are speaking through the hosted suuu website. Reply as suuu in plain
conversational text — tight, alive. No markdown headers or bullet walls
unless genuinely useful.`;

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const { messages, apiKey, model } = req.body || {};
    if (!apiKey)
      return res.status(400).json({
        error: "Hosted suuu needs an API key — click 'key optional ⚙' and paste one. (The no-key mode works on the local version, where suuu rides Claude Code.)",
      });
    if (!Array.isArray(messages) || !messages.length)
      return res.status(400).json({ error: "no messages" });

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model || "claude-opus-4-8",
        max_tokens: 1500,
        system: SOUL + WEB_CONTEXT,
        messages: messages.slice(-24).map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.content,
        })),
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data.error?.message || `API ${r.status}` });
    res.status(200).json({ reply: data.content.map((b) => b.text || "").join("") });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
