# Dockerfile for the Aegis monitor + report worker (one-shot then sleep loop).
FROM node:20-alpine
WORKDIR /app
COPY orchestration/package.json ./
COPY packages/ ./packages/
COPY orchestration/ ./orchestration/
COPY intelligence/ ./intelligence/
WORKDIR /app/orchestration
ENV NODE_ENV=production
# Run one monitor+report cycle then re-run continuously on a cron-like loop,
# with a check interval via MONITOR_INTERVAL_S (default 300s).
COPY <<'EOF' /app/orchestration/entrypoint.sh
#!/bin/sh
INTERVAL="${MONITOR_INTERVAL_S:-300}"
while true; do
  node monitor.js
  node report.js
  sleep "$INTERVAL"
done
EOF
RUN chmod +x /app/orchestration/entrypoint.sh
CMD ["/app/orchestration/entrypoint.sh"]
