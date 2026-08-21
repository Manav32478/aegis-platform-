"""Regenerate the two diagram/chart PNGs used in the evaluation deck.
   - architecture.png : 5-layer architecture diagram (crisp vector text)
   - failover-proof.png: latency over time measured from the running demo
Run from the repo root:  python3 scripts/make_assets.py
"""
import json
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "docs", "assets")
os.makedirs(ASSETS, exist_ok=True)

BG = "#0b0f1a"
PANEL = "#131a2b"
BORDER = "#2c3d66"
TEXT = "#e6ebf5"
MUTED = "#8b96ad"
BLUE = "#4285f4"
GREEN = "#3ddc84"
RED = "#ff5d5d"
AMBER = "#ffb454"

# --------------------------------------------------------------------------- #
# 1. Architecture diagram
# --------------------------------------------------------------------------- #
def architecture():
    fig, ax = plt.subplots(figsize=(9.2, 7.6), dpi=200)
    fig.patch.set_facecolor(BG)
    ax.set_facecolor(BG)
    ax.set_xlim(0, 9.2)
    ax.set_ylim(0, 7.8)
    ax.axis("off")

    def box(x, y, w, h, title, sub, accent=BLUE, fs_t=11.5, fs_s=8.5):
        ax.add_patch(FancyBboxPatch((x, y), w, h,
                                    boxstyle="round,pad=0.06,rounding_size=0.10",
                                    fc=PANEL, ec=accent, lw=1.6, zorder=3))
        ax.text(x + w / 2, y + h - 0.30, title, ha="center", va="center",
                fontsize=fs_t, fontweight="bold", color=TEXT, zorder=4)
        ax.text(x + w / 2, y + 0.24, sub, ha="center", va="center",
                fontsize=fs_s, color=MUTED, zorder=4)

    def arrow(x1, y1, x2, y2, color=MUTED, lw=1.6):
        ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2),
                     arrowstyle="-|>", mutation_scale=14,
                     color=color, lw=lw, zorder=2))

    def layer_label(y, text):
        ax.text(0.08, y, text, ha="left", va="center", fontsize=8,
                color=MUTED, rotation=0, fontweight="bold")

    # Layer 1 — clients
    box(2.1, 6.9, 5.0, 0.72, "CLIENTS / USERS", "browser · curl · third-party apps", accent=MUTED)
    layer_label(6.9 + 0.36 - 0.6, "LAYER 1 · EDGE IN")

    # Layer 2 — router
    box(1.6, 5.5, 6.0, 0.78, "Cloudflare Worker — Failover Router + Cron Monitor",
        "health-checks backends · routes to healthiest cloud in ms", accent=GREEN)
    arrow(4.6, 6.9, 4.6, 6.32)

    # Layer 3 — three clouds
    clouds = [
        (0.55, "Google Cloud Run", "aegis-app\n(2M req/mo free)", BLUE),
        (3.15, "Oracle Cloud", "Always Free VM\n(4 OCPU / 24GB)", RED),
        (5.75, "Render", "aegis-app\n(750 h/mo free)", GREEN),
    ]
    for x, title, sub, c in clouds:
        box(x, 4.15, 2.4, 1.02, title, sub, accent=c, fs_t=10.5)
    arrow(2.7, 5.5, 1.75, 5.21)
    arrow(4.6, 5.5, 4.35, 5.21)
    arrow(6.5, 5.5, 6.95, 5.21)

    # Layer 4 — data
    box(2.1, 2.85, 5.0, 0.82, "Supabase (Postgres)",
        "health_checks · organizations · api_keys · risk_flags", accent=AMBER)
    arrow(1.75, 4.15, 3.6, 3.71)
    arrow(4.35, 4.15, 4.6, 3.71)
    arrow(6.95, 4.15, 5.6, 3.71)

    # Layer 5 — intelligence
    box(0.45, 1.5, 8.3, 0.92, "Intelligence layer",
        "cost.js · carbon.js · policy/*.rego (OPA) · Trivy/Checkov (CI) · ml/predict.py (Isolation Forest)",
        accent=BLUE)
    arrow(4.6, 2.85, 4.6, 2.46)

    # Layer 6 — access
    box(1.6, 0.15, 6.0, 0.92, "Access layer",
        "React dashboard · REST API + Swagger (/api-docs) · public status page + chaos button",
        accent=GREEN)
    arrow(4.6, 1.5, 4.6, 1.11)

    fig.savefig(os.path.join(ASSETS, "architecture.png"),
                facecolor=BG, bbox_inches="tight", pad_inches=0.25)
    plt.close(fig)
    print("wrote architecture.png")

# --------------------------------------------------------------------------- #
# 2. Failover proof chart (from demo/history.jsonl)
# --------------------------------------------------------------------------- #
def failover_proof():
    hist_path = os.path.join(ROOT, "demo", "history.jsonl")
    series = {}
    if os.path.exists(hist_path):
        with open(hist_path) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue
                for r in entry.get("results", []):
                    name = r.get("name", "?")
                    series.setdefault(name, []).append(
                        (r.get("ts", 0), r.get("latency"), r.get("healthy", False), r.get("forced", False))
                    )

    fig, ax = plt.subplots(figsize=(9.0, 3.6), dpi=200)
    fig.patch.set_facecolor(BG)
    ax.set_facecolor(BG)
    colors = {"google-cloud-run": BLUE, "oracle-cloud": RED, "render": GREEN}

    for name, pts in series.items():
        if len(pts) < 2:
            continue
        ts = [p[0] for p in pts]
        t0 = ts[0]
        x = [(t - t0) / 1000 for t in ts]
        y = [p[1] if p[2] else None for p in pts]
        ax.plot(x, y, marker="o", ms=3.5, lw=1.8, color=colors.get(name, MUTED), label=name)
        # shade forced-down windows
        down_start = None
        for i, p in enumerate(pts):
            if p[3] and down_start is None:
                down_start = i
            elif not p[3] and down_start is not None:
                ax.axvspan(x[down_start], x[i], color=RED, alpha=0.18, lw=0)
                down_start = None
        if down_start is not None:
            ax.axvspan(x[down_start], x[-1], color=RED, alpha=0.18, lw=0)

    ax.set_facecolor(BG)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color(BORDER)
    ax.spines["bottom"].set_color(BORDER)
    ax.tick_params(colors=MUTED, labelsize=8)
    ax.set_xlabel("time (s)", color=MUTED, fontsize=9)
    ax.set_ylabel("latency (ms)", color=MUTED, fontsize=9)
    ax.set_ylim(0, None)
    ax.legend(loc="upper left", fontsize=8, facecolor=PANEL, edgecolor=BORDER, labelcolor=TEXT)
    ax.set_title("Measured failover from the running demo (red = forced outage)",
                 color=TEXT, fontsize=10.5, pad=10)

    fig.savefig(os.path.join(ASSETS, "failover-proof.png"),
                facecolor=BG, bbox_inches="tight", pad_inches=0.25)
    plt.close(fig)
    print("wrote failover-proof.png")

if __name__ == "__main__":
    architecture()
    failover_proof()
