/* Aegis v2 — shared data layer for all portal pages (no framework).
 *
 * Aegis.startLive() opens a Server-Sent Events stream to /api/stream and
 * dispatches a 'aegis:data' event on every update. Pages that subscribe
 * render instantly — real-time, no polling. If the stream cannot open (e.g. a
 * sandboxed iframe blocks EventSource) it silently falls back to polling.
 */
(function (global) {
  'use strict';

  let liveStarted = false;

  const A = {
    data: null,
    lastLoad: null,
    _listeners: [],

    fmtAgo(iso) {
      if (!iso) return '—';
      const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
      if (s < 60) return s + 's ago';
      if (s < 3600) return Math.floor(s / 60) + 'm ago';
      if (s < 86400) return Math.floor(s / 3600) + 'h ago';
      return Math.floor(s / 86400) + 'd ago';
    },

    fmtDuration(sec) {
      if (sec == null) return '—';
      if (sec < 60) return sec + 's';
      if (sec < 3600) return Math.floor(sec / 60) + 'm ' + (sec % 60) + 's';
      return Math.floor(sec / 3600) + 'h ' + Math.floor((sec % 3600) / 60) + 'm';
    },

    fmtPct(p) { return p == null ? '—' : p.toFixed(1) + '%'; },

    gradeColor(grade) {
      switch (grade) {
        case 'Excellent': return 'var(--green)';
        case 'Good': return 'var(--cyan)';
        case 'At risk': return 'var(--amber)';
        case 'Critical': return 'var(--red)';
        default: return 'var(--muted)';
      }
    },

    slaColor(status) {
      switch (status) {
        case 'Met': return 'var(--green)';
        case 'Near': return 'var(--amber)';
        case 'At risk': return 'var(--red)';
        default: return 'var(--muted)';
      }
    },

    cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; },

    /** one-shot fetch of the snapshot (used as the SSE fallback) */
    async load(url) {
      const res = await fetch(url || '/api/aggregate');
      if (!res.ok) throw new Error('aggregate HTTP ' + res.status);
      A._apply(await res.json());
      return A.data;
    },

    _apply(payload) {
      A.data = payload;
      A.lastLoad = new Date();
      A.data.__loadAt = A.lastLoad.toISOString();
      window.dispatchEvent(new CustomEvent('aegis:data', { detail: A.data }));
    },

    /** open the real-time stream once; pages just call Aegis.on('data', fn) */
    startLive() {
      if (liveStarted) return;
      liveStarted = true;
      let fellBack = false;

      const poll = () => {
        setTimeout(async () => {
          try {
            const res = await fetch('/api/live');
            if (res.ok) A._apply(await res.json());
          } catch { /* offline */ }
          poll();
        }, 10000);
      };

      try {
        const es = new EventSource('/api/stream');
        es.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg && msg.type === 'update') A._apply(msg);
          } catch { /* malformed frame */ }
        };
        es.onerror = () => {
          if (!fellBack) { fellBack = true; es.close(); poll(); }
        };
      } catch {
        poll();
      }
    },

    on(event, fn) {
      window.addEventListener(event, (e) => fn(e.detail));
    },

    init() {
      const TOGGLE = 'aegis_theme';
      const applyTheme = (t) => {
        document.documentElement.setAttribute('data-theme', t);
        document.body.classList.toggle('dark', t === 'dark');
        document.body.classList.toggle('light', t === 'light');
      };
      A.setTheme = (t) => { localStorage.setItem(TOGGLE, t); applyTheme(t); };
      A.toggleTheme = () => A.setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
      const saved = localStorage.getItem(TOGGLE) || 'dark';
      applyTheme(saved);
    },

    toast(msg, isError) {
      let box = document.getElementById('flash');
      if (!box) {
        box = document.createElement('div');
        box.id = 'flash';
        document.body.appendChild(box);
      }
      const t = document.createElement('div');
      t.className = 'toast' + (isError ? ' error' : '');
      t.textContent = msg;
      box.appendChild(t);
      setTimeout(() => t.remove(), 4200);
    },
  };

  A.init();
  global.Aegis = A;
})(window);
