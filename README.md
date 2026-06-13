# Storm's Calling Studio

A private, **local‑first** fantasy‑writing studio: a rich‑text manuscript editor, a worldbuilding codex, a master timeline, an interactive map, and a deep Claude AI co‑writer — all running on your own machine. Nothing is uploaded anywhere except the requests you choose to send to the Anthropic API. Your data lives in `./data/`.

The interface is recreated pixel‑for‑pixel from a Claude Design mockup: a warm **parchment + forest‑green + clay** palette, with light and dark themes, set in *IM Fell English*, *Lora*, and *Inter*.

---

## Prerequisites

- **Node.js 18+** (developed and tested on Node 24). No Python or C/C++ build tools are required — `better-sqlite3` installs a prebuilt binary.
- An **Anthropic API key** (optional). The editor, codex, timeline, map, search, export, and everything non‑AI work fully **without** a key — only the co‑writer, inline writing tools, and continuity checker need one.

## Install

```bash
npm install
```

This installs both workspaces (`server` and `client`) in one step.

## Configure your API key (`.env`)

Copy the example file and add your key:

```bash
cp .env.example .env
```

Then edit `.env`. You can use **Claude (Anthropic)**, **ChatGPT (OpenAI)**, or **Gemini (Google)** — add a key for whichever you want and pick it in **Settings → AI** (Claude is the default):

```
ANTHROPIC_API_KEY=sk-ant-...      # Claude (default)
# OPENAI_API_KEY=sk-...           # ChatGPT (optional)
# GEMINI_API_KEY=...              # Gemini (optional; GOOGLE_API_KEY also works)
```

- Keys are read **only by the backend** and are never exposed to the browser.
- You only need a key for the provider you select; switching providers is done in **Settings → AI**, where you can also set the model id per provider.
- `.env` and `./data/` are git‑ignored.
- Without a key for the selected provider, the app still runs — the co‑writer simply shows a friendly “add a key” message instead of replying.

Optional overrides (all have sensible defaults in `server/src/config.ts`):

```
# AI_PROVIDER=anthropic   # anthropic | openai | google (also switchable in Settings)
# CLAUDE_MODEL=claude-opus-4-8
# OPENAI_MODEL=gpt-4o
# GEMINI_MODEL=gemini-2.0-flash
# CLIENT_PORT=3000        # the app URL you open in the browser
# SERVER_PORT=5174        # backend API port (kept behind the frontend)
# HOST=0.0.0.0            # bind address (0.0.0.0 enables LAN/iPad access)
```

## Run

```bash
npm run dev
```

This starts the backend and the Vite frontend together and prints the local and LAN URLs, for example:

```
Local:   http://localhost:3000
LAN:     http://192.168.1.20:3000   ← open on iPad / iPhone (same WiFi)
```

The server binds to `0.0.0.0`, so you can open the LAN URL on an iPad or iPhone on the same WiFi and write from the couch. Data is shared — it all lives in the one `./data/` database on your machine.

### Production build (single port)

```bash
npm run build      # builds client + server
npm start          # serves the built client and API from the backend
```

In production the server honours the `PORT` env var (cloud hosts inject it); locally it falls back to `SERVER_PORT` (5174).

---

## Login & private deployment

### Lock the app with a username + password

Set **both** `AUTH_USERNAME` and `AUTH_PASSWORD` (in `.env` locally, or as host secrets when deployed) and the entire app — every API route **and** every uploaded image — sits behind a single‑user, liquid‑glass sign‑in screen. The browser never sees the credentials; the server verifies them and issues a signed, http‑only session cookie (valid 30 days). Add `SESSION_SECRET` (any long random string) to sign that cookie; if you omit it, a stable key is derived from your credentials.

```
AUTH_USERNAME=you
AUTH_PASSWORD=a-long-strong-password
SESSION_SECRET=...        # e.g. `openssl rand -hex 32`
```

Leave these **unset** (the local default) and there is no login wall — the studio stays frictionless on your own machine. The wall only switches on when the credentials are present, i.e. on your deployment. Sign out anytime from the icon in the top‑right of the header.

### Deploy privately to Fly.io (free, keeps your data)

Because your work lives in a SQLite database + image files under `./data/`, the host needs a **persistent disk** — so static hosts (GitHub Pages, Vercel, Netlify) won't do. The included `Dockerfile` + `fly.toml` deploy to [Fly.io](https://fly.io), which has a free allowance and a persistent volume.

```bash
# 1. Install flyctl and sign in
#    https://fly.io/docs/flyctl/install/
fly auth login

# 2. Create the app (uses the bundled fly.toml; pick a unique name + nearby region)
fly launch --no-deploy --copy-config --name your-unique-name

# 3. Create the persistent disk for ./data  (1 GB is plenty)
fly volumes create scs_data --size 1

# 4. Set your private login + (optional) AI key as encrypted secrets
fly secrets set AUTH_USERNAME=you AUTH_PASSWORD='a-strong-password' SESSION_SECRET="$(openssl rand -hex 32)"
fly secrets set ANTHROPIC_API_KEY=sk-ant-...        # optional — enables the co-writer

# 5. Ship it
fly deploy
```

Fly prints your URL (e.g. `https://your-unique-name.fly.dev`). Open it, sign in, and write from anywhere — only you can get in. The same `Dockerfile` also works on Render or Railway if you'd rather use those (point the service at the repo, add a persistent disk mounted at `/app/data`, and set the same env vars).

---

## Feature guide

### Manuscript
- A nestable tree of **Books → Parts → Chapters → Pages**, plus free pages and folders. Drag to reorder, right‑click for **Rename / New page / New chapter / Status / Pin / Delete**, and collapse with the chevrons. The sidebar is resizable (drag its right edge).
- The editor is a full **TipTap** surface: bold/italic/underline/strike, H1–H3, lists, blockquote, divider, images, text colour, and highlight.
- Type **`/`** for the slash block menu. Select text to bring up the floating **AI writing tools**.
- **Images** paste, drag‑drop, or insert via the slash menu — they’re saved to `./data/images/` and served from `/uploads/`.
- **Autosave** runs ~800 ms after you stop typing (the header shows *saving… / saved*). **⌘S** forces a save.
- **Focus mode** (**⌘⇧F** or the frame icon) hides the chrome; **Typewriter scrolling** (Settings → Editor) keeps the caret line centred.
- The status bar tracks **scene / book / this‑session** word counts; *reset* re‑bases the session counter.

### Codex & @-mentions
- Entity types: **Character, Nation, Location, Faction, Concept** — each with a name, aliases, cover image, type badge, and a rich‑text body. The sidebar groups them under *Characters* and *World* with live counts.
- While writing, type **`@`** to fuzzy‑search your codex (aliases included). Pick an entry to link it, or **quick‑create** a new one inline.
- **Hover** a mention for a preview card (cover, type, description); **click** it to open the full codex page.
- Each codex page shows a **Backlinks** section, computed on read, listing every scene that mentions the entry with a snippet and location.

### Lore Bible pin
- Right‑click any page → **Pin as Lore Bible 📌** (it gets a 📌 in the sidebar). Pinned pages become the **Lore Bible** context toggle in the co‑writer, so your canon travels with every question and every continuity check. You can pin more than one page.

### Co-writer (AI chat)
- A collapsible right‑hand panel. Toggle **context chips** — *Current scene*, *Chapter*, *Codex* (the entries mentioned in the current scene), and *Lore Bible* — and watch the live **token estimate** update.
- Replies **stream** in. Keep **multiple named threads**; create new ones with **+**.
- **Choose your AI provider** — Claude, ChatGPT, or Gemini — and set the model id per provider in Settings → AI. The co‑writer, inline writing tools, and continuity checker all use the selected provider.
- Edit the co‑writer’s default **system prompt** in Settings → AI.

### Conversation import
- In the co‑writer panel, **Import conversation from claude.ai**: paste a chat and it becomes a **read‑only** thread beside your draft, so your planning stays next to your manuscript. The importer recognises “You said / Claude said” style markers and falls back to alternating blocks.

### Inline AI writing tools
- Select a passage → **Tighten · More sensory · Continue · ✏ Custom**. Results open in a **slide‑in diff panel** (original on top, an **editable** suggestion below). **Accept** (replaces the selection, or appends for *Continue*), **Reject**, or **Retry**.
- **Your text is never changed without an explicit Accept.**

### Continuity checker
- In the editor toolbar, **Check continuity** scans the current scene against your codex and pinned Lore Bible and returns a dismissible checklist of flags (a quote, the issue, and a suggested fix). Flags persist per scene; an empty result shows **“No continuity issues found ✓”**.

### Timeline
- A horizontal, zoomable track of event cards (title, in‑world date, description, linked‑entity badges, optional scene link). Click the track’s **+ Event** to add, click a card to edit, **drag** cards to re‑date, and use the **entity chips** to filter (non‑matching events dim). The in‑world **calendar** (format, seasons, year) is configurable in Settings → World.

### Map
- Upload one or more map images (drag‑drop or click). **Pan/zoom**, **double‑click** to drop a pin linked to a Location or Nation (or a plain label), **drag** pins to reposition, and **click** a pin to open the linked codex entry in a slide‑in panel. Pins persist per map; switch maps with the tabs.

### Search (⌘K)
- A global overlay that searches the manuscript, codex, threads, and timeline live, grouped by type and keyboard‑navigable (↑/↓, Enter, Esc).

### Keyboard shortcuts
| Shortcut | Action |
|---|---|
| ⌘K | Global search |
| ⌘S | Force save |
| ⌘⇧F | Focus mode |
| ⌘⇧T | Timeline |
| ⌘⇧M | Map |
| ⌘⇧C | Codex |
| `/` | Slash block menu (in editor) |
| `@` | Mention a codex entry (in editor) |

---

## Versions, export & backup/restore

- **Version snapshots** are stored per page (`versions` table) and can be created manually or as safety snapshots; **restoring** a snapshot always takes a safety snapshot of the current state first.
- **Export a node** to Markdown or `.docx` via the API (`/api/export/page/:id?format=md|docx`). **PDF**: open the page and use your browser’s *Print → Save as PDF* on the manuscript column.
- **Codex export**: Settings → Data → *Codex Export →* downloads every entry as a Markdown zip.
- **Full backup**: Settings → Data → *Backup Export →* downloads a zip of the SQLite database **and** the `images/` folder.
- **Restore**: stop the app, replace the contents of `./data/` with the unzipped backup (`storms-calling.db` and `images/`), and restart.

---

## Tech & layout

- **Frontend:** React + Vite + TypeScript + Tailwind; **TipTap v3** editor; **react‑zoom‑pan‑pinch** for the map; **zustand** for state.
- **Backend:** Node + Express + TypeScript; **better‑sqlite3** at `./data/storms-calling.db` (WAL mode); images as files in `./data/images/`.
- **AI:** pluggable provider — **Claude** (Anthropic SDK), **ChatGPT** (OpenAI SDK), or **Gemini** (Google GenAI SDK), selectable in Settings; called **only** from the backend; streaming over SSE; default model `claude-opus-4-8`.

```
StormCallingAPP/
├─ client/   # React app (features/editor, codex, timeline, map, chat, settings)
├─ server/   # Express API (routes/, db.ts, anthropic.ts, config.ts)
├─ data/     # SQLite db + images   (git-ignored, created on first run)
└─ .env      # ANTHROPIC_API_KEY    (git-ignored)
```

First launch creates the database and a single **“Getting started”** page — no fake seed data — explaining @‑mentions, the Lore Bible pin, the AI tools, and conversation import.
