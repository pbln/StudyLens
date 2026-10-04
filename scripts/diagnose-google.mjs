// Usage:  GOOGLE_API_KEY=your_key node scripts/diagnose-google.mjs [model]
// Tells you whether the key works, and whether the problem is the key, the model, or Google's server.
const key = process.env.GOOGLE_API_KEY;
const model = process.argv[2] || 'gemma-4-31b-it';
if (!key) { console.error('Set GOOGLE_API_KEY first.'); process.exit(1); }
const base = 'https://generativelanguage.googleapis.com/v1beta';
const H = { 'Content-Type': 'application/json', 'x-goog-api-key': key };

async function show(label, res) {
  const body = await res.text();
  console.log(`\n=== ${label}\nHTTP ${res.status}\n${body.slice(0, 800)}`);
  return res.status;
}

// 1) Key check: listing models needs no model quota. 200 = key is valid.
const listStatus = await show('1. List models (key check)', await fetch(`${base}/models?pageSize=200`, { headers: H }));

// 2) Tiny request on each model. Same key, so differences point at the model, not the key.
for (const m of [model, 'gemma-4-26b-a4b-it', 'gemini-2.5-flash']) {
  const res = await fetch(`${base}/models/${m}:generateContent`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply with the single word: ok' }] }], generationConfig: { temperature: 0.2 } }),
  });
  await show(`2. generateContent on ${m}`, res);
}

console.log(listStatus === 200
  ? '\nKey is VALID. If step 2 fails with 500 only for one model, it is that model/Google, not your key.'
  : '\nKey check failed: the key itself (or its project/API access) is the problem.');
