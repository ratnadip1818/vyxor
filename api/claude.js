// Vyxor — Secure Claude API Proxy
// Server-side trial enforcement via Firebase token verification.

const ALLOWED_ORIGINS = [
  'https://vyxor.in',
  'https://www.vyxor.in',
  'http://localhost:3000',
  'http://localhost:5173'
];

const TRIAL_DAYS = 15;

// Rate limit per IP
const rateLimit = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 20;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimit.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + RATE_LIMIT_WINDOW_MS; }
  entry.count++;
  rateLimit.set(ip, entry);
  return entry.count <= RATE_LIMIT_MAX;
}

// Verify Firebase ID token and check trial/plan status
async function verifyToken(token) {
  if (!token) return { valid: false, reason: 'No token provided.' };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'vyxor-3f94c';

  try {
    // Verify token with Firebase
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token })
      }
    );

    if (!verifyRes.ok) return { valid: false, reason: 'Invalid session. Please sign in again.' };
    const verifyData = await verifyRes.json();
    const uid = verifyData?.users?.[0]?.localId;
    if (!uid) return { valid: false, reason: 'User not found.' };

    // Check user plan in Firestore
    const firestoreRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    if (!firestoreRes.ok) {
      // Can't read Firestore — allow (new user, no doc yet)
      return { valid: true, uid };
    }

    const fsData = await firestoreRes.json();
    const fields = fsData?.fields || {};
    const plan = fields?.plan?.stringValue || 'trial';
    const trialStarted = fields?.trialStarted?.stringValue || null;

    // Pro user — always allow
    if (plan === 'pro') return { valid: true, uid, plan: 'pro' };

    // Trial user — check expiry
    if (trialStarted) {
      const daysElapsed = Math.floor((Date.now() - new Date(trialStarted)) / (1000 * 60 * 60 * 24));
      if (daysElapsed >= TRIAL_DAYS) {
        return { valid: false, reason: 'Your trial has expired. Upgrade to continue using AI features.' };
      }
    }

    return { valid: true, uid, plan: 'trial' };
  } catch (err) {
    console.error('Token verification error:', err);
    // On error — allow request (don't block legitimate users due to infra issues)
    return { valid: true, uid: 'unknown' };
  }
}

export default async function handler(req, res) {
  // CORS
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again in an hour.' });
  }

  // Validate API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server misconfiguration.' });

  const { prompt, maxTokens = 1500, model = 'claude-haiku-4-5-20251001', token } = req.body || {};

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt is required.' });
  }
  if (prompt.length > 50000) return res.status(400).json({ error: 'prompt too long.' });
  if (maxTokens > 4000) return res.status(400).json({ error: 'maxTokens too high.' });

  // Server-side trial verification (only if FIREBASE_API_KEY is set)
  if (process.env.FIREBASE_API_KEY && token) {
    const { valid, reason } = await verifyToken(token);
    if (!valid) return res.status(403).json({ error: reason });
  }

  // Call Anthropic
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic error:', response.status, errText);
      return res.status(response.status).json({ error: 'AI service error. Try again.' });
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text || '';
    return res.status(200).json({ text });
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: 'Network error. Try again.' });
  }
}
