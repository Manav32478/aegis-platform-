# Oracle Cloud Always-Free VM — 24/7 Control Plane (₹0 forever)

This turns Aegis from "serverless-only" into a **real professional platform**:
your own always-on Linux server running the portal, the API, the monitor and the
report generator — plus it acts as a **third independent monitoring vantage
point** (so you can honestly say you watch Render + Vercel from three places).

> ⚠️ Oracle asks for a **debit/credit card once** for identity verification.
> You are **never charged** as long as you stay inside Always-Free limits
> (which this guide guarantees). There is no auto-upgrade in the free tier.

---

## What you get (Always Free, as of 2026)

| Resource | Limit |
|---|---|
| Ampere A1 ARM compute | 2 OCPU + 12 GB RAM (post Aug-2026) or E2.1.Micro ×2 |
| Block storage | 200 GB total |
| Outbound bandwidth | ~10 TB / month |

*More than enough.* Aegis needs only a slice of this.

---

## Step 1 — Create the account & VM (15 min)

1. Go to https://www.oracle.com/cloud/free/ → **Start for free**.
2. Choose **Home region**: pick one close to you, e.g. **Hyderabad** or
   **Mumbai** (or Frankfurt/Singapore if the close ones say "out of capacity").
3. Verify email + card (a ₹1-style temporary hold may flash and vanish — that's
   normal and refunded).
4. Open the **OCI Console** → **Compute → Instances → Create instance**:
   - **Image:** Ubuntu 22.04 (Canonical) — free.
   - **Shape:** `VM.Standard.E2.1.Micro` (AMD, 1 GB) — the simplest always-free
     shape for our light workload, OR `VM.Standard.A1.Flex` (2 OCPU / 12 GB).
   - **Add SSH keys:** generate one on your Mac (Step 2) and paste the public key.
   - **Boot volume:** default (~47 GB, within free 200 GB).
5. Click **Create**. Copy the **Public IP**.
6. Open the **Security List** for the instance's subnet (Networking → Virtual
   Cloud Networks → subnet → Security Lists) and add **Ingress Rules** (0.0.0.0/0):
   - TCP **3100** (portal) · TCP **4000** (API) · TCP **22** (SSH, already there).

---

## Step 2 — SSH key on your Mac

```bash
ssh-keygen -t ed25519 -C "your-email"   # press Enter for defaults; no passphrase
cat ~/.ssh/id_ed25519.pub               # copy this into the "Add SSH keys" box above
```

Connect (replace with your real IP):

```bash
ssh -i ~/.ssh/id_ed25519 ubuntu@YOUR_VM_IP
```

---

## Step 3 — Install Docker and run Aegis

```bash
# on the VM
sudo apt update
sudo apt install -y git docker.io docker-compose-v2
sudo usermod -aG docker $USER && newgrp docker

git clone https://github.com/Manav32478/aegis-platform-.git
cd aegis-platform-
cp .env.example .env
nano .env          # set SUPABASE_URL, SUPABASE_KEY (publishable), ADMIN_TOKEN, save with Ctrl+O
sudo docker compose up -d --build
```

Check:

```bash
curl http://localhost:3100/api/health      # {"status":"ok","service":"aegis-web"}
```

Then open in your browser: **`http://YOUR_VM_IP:3100`** → portal, dashboard,
status, admin. The monitor is already writing `region='oracle-vm'` checks to
Supabase every 5 minutes.

---

## Step 4 — Point a domain or just use the IP

- Free option: keep using `http://YOUR_VM_IP:3100`.
- Nicer option: free subdomain from **DuckDNS** (https://www.duckdns.org) →
  e.g. `aegis.duckdns.org`, and set up a free HTTPS cert:

```bash
# optional, if you want HTTPS + a name
sudo apt install -y certbot
sudo certbot certonly --standalone -d aegis.duckdns.org
```

---

## Step 5 — Keep it alive & healthy (free cron)

The VM itself is always-on (unlike Render). Just make sure the containers
restart if they ever crash (the compose file already sets `restart: unless-stopped`).

Optional: automatic security updates:

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

---

## What this unlocks for your evaluation

1. **"Platform runs in production 24/7"** — real, not just a free-tier demo.
2. **A 3rd monitoring vantage point** — Render + Vercel are watched from
   Cloudflare edge, GitHub runners, *and* your own Oracle VM.
3. **Self-contained scoring** — kill any cloud, watch the dashboard reroute.
4. **Screenshot-material** — SSH session + `htop` + dashboard = strong viva evidence.

## Safety checklist (stay ₹0)

- [ ] Use `E2.1.Micro` or A1.Flex **within** 2 OCPU / 12 GB.
- [ ] Boot volume ≤ 200 GB (default 47 GB is fine).
- [ ] Never click "Upgrade to Pay As You Go".
- [ ] Keep the instance in a **home region**, don't add paid shapes.
