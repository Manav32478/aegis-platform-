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

test('expired snapshots are rebuilt and concurrent requests share one build', async () => {
  let now = Date.now();
  const spy = jest.spyOn(Date, 'now').mockImplementation(() => now);
  try {
    now += 100000;
    let builds = 0;
    const provider = async () => { builds++; return { sequence: builds }; };
    const first = await realtime.getSnapshot(provider);
    expect(first.sequence).toBe(1);
    expect((await realtime.getSnapshot(provider)).sequence).toBe(1);
    now += 30001;
    const [a, b] = await Promise.all([realtime.getSnapshot(provider), realtime.getSnapshot(provider)]);
    expect(a.sequence).toBe(2);
    expect(b.sequence).toBe(2);
    expect(builds).toBe(2);
  } finally { spy.mockRestore(); }
});
