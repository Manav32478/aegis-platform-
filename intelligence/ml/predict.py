"""Aegis predictive failover — Isolation Forest on health-check history (Month 4).

Reads health_checks from Supabase (plain REST, stdlib only — no client dep),
builds a per-cloud rolling-latency feature, flags clouds whose recent checks look
anomalous, and writes the result to risk_flags (read by the live status page).

Usage:
  SUPABASE_URL=... SUPABASE_KEY=... python predict.py   # real run (GitHub Action)
  python predict.py --demo                               # self-contained demo
"""
import json
import os
import sys
import urllib.request

import pandas as pd
from sklearn.ensemble import IsolationForest

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

MIN_ROWS = 10           # need a little history before training is meaningful
RECENT_WINDOW = 3       # a cloud is "at risk" if any of its last N checks is anomalous
LATENCY_MISSING = 9999  # a failed check (null latency) counts as "very slow"


# --- Supabase REST helpers (stdlib only) -------------------------------------
def supabase_get(path):
    req = urllib.request.Request(
        f"{SUPABASE_URL}{path}",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def supabase_post(path, payload):
    req = urllib.request.Request(
        f"{SUPABASE_URL}{path}",
        data=json.dumps(payload).encode(),
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status


def load_data():
    rows = supabase_get(
        "/rest/v1/health_checks?select=id,cloud_name,healthy,latency,checked_at&order=id.asc&limit=10000"
    )
    return pd.DataFrame(rows)


def train(df):
    """Add rolling-latency feature and Isolation Forest risk_score (-1 = anomalous)."""
    df = df.copy()
    df = df.sort_values("checked_at")
    df["latency"] = df["latency"].fillna(LATENCY_MISSING)
    df["rolling_latency"] = (
        df.groupby("cloud_name")["latency"]
        .transform(lambda s: s.rolling(RECENT_WINDOW, min_periods=1).mean())
        .fillna(LATENCY_MISSING)
    )
    model = IsolationForest(contamination=0.05, random_state=42)
    df["risk_score"] = model.fit_predict(df[["rolling_latency"]])
    return df


def current_risk(df):
    """Map cloud_name -> True if any of its RECENT_WINDOW checks are anomalous."""
    risk = {}
    for name, g in df.groupby("cloud_name"):
        recent = g.sort_values("checked_at").tail(RECENT_WINDOW)
        risk[name] = bool((recent["risk_score"] == -1).any())
    return risk


def demo_mode():
    """Synthetic demo: two stable clouds + one cloud that degrades at the end."""
    print("demo mode: two stable clouds + one degrading cloud\n")
    ts = pd.date_range("2026-08-01", periods=60, freq="5min")
    a = pd.DataFrame(
        {"cloud_name": "render", "checked_at": ts, "latency": [40 + (i % 5) * 3 for i in range(60)]}
    )
    b = pd.DataFrame(
        {"cloud_name": "vercel", "checked_at": ts, "latency": [55 + (i % 4) * 2 for i in range(60)]}
    )
    # oracle: stable at first, then latency climbs sharply in the last 12 checks
    c = pd.DataFrame(
        {"cloud_name": "oracle", "checked_at": ts,
         "latency": [35] * 48 + [35 + i * 60 for i in range(12)]}
    )
    df = pd.concat([a, b, c], ignore_index=True)
    df = train(df)
    risk = current_risk(df)
    for name, flagged in risk.items():
        print(f"  {name:10s} -> {'AT RISK ⚠' if flagged else 'healthy'}")
    print(
        "\n(Isolation Forest learned each cloud's normal latency range and",
        "flagged the one that started degrading.)",
    )
    return risk


def main():
    if "--demo" in sys.argv:
        demo_mode()
        return
    if not (SUPABASE_URL and SUPABASE_KEY):
        print("no SUPABASE_URL/SUPABASE_KEY — run with --demo for a local demo")
        sys.exit(1)

    df = load_data()
    if df.empty:
        print("no health_checks yet")
        return
    if len(df) < MIN_ROWS:
        print(
            f"only {len(df)} checks so far — need ≥{MIN_ROWS} before training "
            "(model is live; collecting history)"
        )
        return

    df = train(df)
    risk = current_risk(df)
    print("current risk:", {k: v for k, v in risk.items()})

    flags = [{"cloud_name": n} for n, flagged in risk.items() if flagged]
    if flags:
        status = supabase_post("/rest/v1/risk_flags", flags)
        print(f"wrote {len(flags)} risk_flag(s) to Supabase (HTTP {status})")
    else:
        print("all clouds healthy — no flags written")


if __name__ == "__main__":
    main()
