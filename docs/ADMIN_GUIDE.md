# Aegis Admin Console — How to Use It

> The admin page (`/admin.html`) is the **control room** where you manage what
> the platform watches. It's protected by a token so only YOU can change things.

---

## 🔐 1. Unlock it (the "admin token")

**You just fixed this — it now works out of the box.** When you run
`./start.sh`, the server starts with token **`aegis-demo`**.

To use the admin page:

1. Start the platform:  `./start.sh`  →  open `http://localhost:3100/admin.html`
2. In the **"Admin token" box**, type **`aegis-demo`** → click **Save token**.

That's it. The page unlocks. (The token is saved in that browser, so you only
do this once.)

> **For a real deployment** (Oracle VM / public), set a strong password instead:
> `ADMIN_TOKEN=MyStrongPass123 node server.js`  →  and paste `MyStrongPass123`.

---

## 🧩 What each section does

### 📋 "Monitored targets" — the heart of the platform

This list = **which clouds Aegis watches**. Right now it shows your real ones:

| Cloud | URL | Enabled |
|---|---|---|
| render | `...onrender.com/health` | ✅ on |
| vercel | `...vercel.app/health` | ✅ on |
| google-cloud-run | planned | ⭕ off |
| oracle-cloud | planned | ⭕ off |

**What you can do here:**
- **➕ Add a target** — type a cloud name + its `/health` URL + region, click
  **Add target**. Example when you set up your Oracle VM:
  - cloud name: `oracle-cloud`
  - url: `http://YOUR_VM_IP:3000/health`
  - region: `ap-mumbai-1`
- **enable / disable** any cloud (the button on the right) — disable a broken
  cloud so it stops counting against your uptime while you fix it.

> 🔧 I also just wired the **monitor** to read this table — so anything you add
> here is what `orchestration/monitor.js` actually probes. (Before, the monitor
> only used the hardcoded default list.)

### 🗝️ "Generate API key"

Creates an **API key** for a developer/customer to use your API
(`api/` service, `http://localhost:4000/api-docs`).

- Type an org name (e.g. `acme`) → **Generate**.
- It creates the org + a hashed key in Supabase and shows the key **once**.
- The user then calls: `curl -H "x-api-key: ak_..." http://localhost:4000/api/status`

**Why this matters for the evaluation:** it demonstrates **multi-tenancy** —
different customers get different keys, and every call is rate-limited and
audited.

### 📜 "Audit log"

Every authenticated API call + admin action is recorded here (who, what, when).
Great for showing "security is taken seriously."

### 📊 "Generate report now"

Creates a daily health report on demand and stores it in `health_reports`
(visible via `/api/reports` and the dashboard). If you configure Resend/Slack,
it also emails/posts it.

---

## 🖥️ The "show it to faculty" script (45 seconds)

1. Open `admin.html` → type `aegis-demo` → **Save** → *"the admin console is
   token-protected."*
2. Point at **Monitored targets** → *"this is the live list of what the
   platform watches — Render and Vercel enabled, Cloud Run and Oracle ready to
   flip on."*
3. Click **Add target** demo or toggles → *"I can add or disable a cloud from
   here — and the monitor immediately starts using the new list."*
4. Point at **Generate API key** + **Audit log** → *"every customer of the API
   gets a hashed key, is rate-limited, and every call is logged here."*

**One-liner if asked "what is the admin section?":**
> *"It's the protected control plane — add/disable monitored clouds, issue API
> keys, and review the audit trail. In production it would run with a strong
> password and be the only place these changes can be made."*

---

## ⚠️ Demo mode vs production (say this if asked)

- **Demo (now):** default token `aegis-demo`, writes use Supabase RLS.
- **Production:** set a strong `ADMIN_TOKEN`, and move writes behind a Supabase
  Edge Function with the `service_role` key (documented in
  `docs/free-tier-notes.md`).
