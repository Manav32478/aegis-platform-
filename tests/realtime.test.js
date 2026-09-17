// Tests the realtime hub (SSE broadcaster) — Month 6 / v2.
const realtime = require('../web/realtime');

test('broadcasts snapshots to all subscribers', async () => {
  const received = [];
  const off = realtime.subscribe((msg) => received.push(JSON.parse(msg)));

  // run one tick against an offline provider
  await new Promise((resolve) => {
    const provide = async () => ({ ok: true, at: new Date().toISOString() });
    realtime.start(provide);
    setTimeout(resolve, 50);
  });
  // stop any future ticks so jest can exit
  realtime.stop();

  expect(received.length).toBeGreaterThanOrEqual(1);
  expect(received[0].type).toBe('update');
  expect(received[0].ok).toBe(true);

  // cache is set
  expect(realtime.getCache().ok).toBe(true);

  off();
});
