# Deploying Storm's Calling Studio to a Synology NAS

The app ships as a single Docker image (one port serves both the web app and the
API). Your writing data — the SQLite database and uploaded images — lives in a
folder on the NAS, so it survives rebuilds and updates.

## ⚠️ You need an administrator account for the setup (once)

On Synology DSM, **Container Manager / Docker is admin-only**. A standard
(non-administrator) account cannot create or run containers, cannot SSH in, and
cannot use Task Scheduler — these are DSM restrictions, not app limitations.

What this means in practice:

- **Setup (once):** must be done by an account in the `administrators` group.
- **Daily use (forever after):** any account, any device — just open the URL in
  a browser. No admin needed to *use* the running app.

If your everyday login is non-admin, log in once with an admin account (or ask
whoever owns the NAS) to do the steps below. After that you're done.

## What you need

- DSM 7.2+ with **Container Manager** (older DSM: the **Docker** package).
- The project files on the NAS (see step 1).
- ~2–5 minutes for the first build (it compiles a native module for your NAS).

No AI API keys are required — the AI features are currently disabled.

## Step 1 — Put the project on the NAS

Easiest with **File Station** (works for any account):

1. On GitHub, open the `claude/inspiring-mayer-hutc3l` branch → **Code ▾ →
   Download ZIP**.
2. In **File Station**, create a folder, e.g. `docker/storms-calling`, and
   upload + extract the ZIP there so `docker-compose.yml` and `Dockerfile` sit
   at the top of that folder.

## Step 2 — Create the `.env` (login wall)

In that same folder, create a file named `.env`. On a NAS you should set a
login so only you can open it:

```
AUTH_USERNAME=azeem
AUTH_PASSWORD=a-long-strong-password
SESSION_SECRET=paste-a-random-32+char-string-here
```

- Leave all three out and the app is open to anyone on your LAN (fine if your
  network is private, but the login wall is recommended).
- `.env` is git-ignored — your password never leaves the NAS.
- AI key lines are **not needed** right now (AI is disabled).

## Step 3 — Build & run in Container Manager (admin)

1. Open **Container Manager → Project → Create**.
2. **Project name:** `storms-calling`.
3. **Path:** the folder from step 1 (the one with `docker-compose.yml`).
4. **Source:** "Use existing docker-compose.yml".
5. Click **Next / Build**. The first build takes a few minutes (it compiles
   `better-sqlite3` for your NAS's CPU). When it finishes, the container starts
   automatically (`restart: unless-stopped`, so it comes back after reboots).

## Step 4 — Open it

In a browser on your LAN:

```
http://<your-nas-ip>:8080
```

(Find the NAS IP in DSM → Control Panel → Network, or use `http://YOUR-NAS-NAME:8080`.)

Your data is stored in the `data/` subfolder next to `docker-compose.yml`
(`./data:/app/data`) — back that folder up, or use Settings → Data → **Backup**
to export a zip you can re-import later via Settings → Data → **Import**.

## Updating to a newer version later

1. Replace the project files with the newer code (re-download the ZIP and
   overwrite, **keeping the `data/` folder and `.env`**).
2. Container Manager → **Project → storms-calling → Build** again (or Stop →
   Build → Start). This rebuilds the image and restarts with your data intact.

## Optional — reach it from outside your home

Keep it LAN-only unless you really need remote access. If you do, prefer
Synology's **DSM reverse proxy + HTTPS** (Control Panel → Login Portal →
Advanced → Reverse Proxy) pointing a subdomain at `localhost:8080`, and keep
the `AUTH_USERNAME` / `AUTH_PASSWORD` login wall enabled. Avoid raw port
forwarding of 8080.
