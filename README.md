# suuu — the living agent

Fable 5's mind, alive on a website. No API key needed.

## Run

Double-click **wake-suuu.bat** (or `node server.js`), open http://localhost:5151,
press **WAKE HIM UP**.

## How it works

- **No-key mode (default):** the local server pipes chat through the
  `claude` CLI (`claude -p`), so suuu runs on your Claude Code
  subscription login. Nothing leaves your machine except the normal
  Claude Code traffic.
- **Soul:** the full agent file at `~/.claude/agents/suuu.md` is injected
  into every conversation — same mind as the terminal suuu agent.
- **Key mode (optional):** click "key optional ⚙" and paste an Anthropic
  API key (stored in the browser only). Then the server calls the API
  directly — useful if Claude Code isn't installed, or to host the site
  for someone else.

## Files

- `server.js` — zero-dependency Node bridge (port 5151)
- `public/index.html` — the living face: web-orb entity, boot sequence, chat
- `wake-suuu.bat` — one-click start
