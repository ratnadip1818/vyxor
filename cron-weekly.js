// api/cron-weekly.js
// 3 cron jobs call this — one per region (India, London, New York)
// Each runs at 9am local Sunday time
// Users are filtered by timezone saved during onboarding

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import sendWeeklyEmail from './send-weekly-email.js';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

// Which timezones belong to which region
const REGION_TIMEZONES = {
  india:   ['Asia/Kolkata', 'Asia/Colombo', 'Asia/Kathmandu'],
  london:  ['Europe/London', 'Europe/Lisbon', 'Africa/Accra', 'UTC'],
  newyork: ['America/New_York', 'America/Toronto', 'America/Chicago',
            'America/Denver', 'America/Los_Angeles', 'America/Vancouver',
            'America/Sao_Paulo', 'America/Buenos_Aires']
};

// Default region for users who haven't set timezone
const DEFAULT_REGION = 'india';

function getWeekLabel() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = d => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${fmt(monday)} – ${fmt(sunday)} ${sunday.getFullYear()}`;
}

function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getUserRegion(userData) {
  const tz = userData.timezone || '';
  for (const [region, tzList] of Object.entries(REGION_TIMEZONES)) {
    if (tzList.includes(tz)) return region;
  }
  // Fallback — detect from trading markets set during onboarding
  const markets = userData.tradingMarkets || '';
  if (markets.includes('NSE') || markets.includes('MCX') || markets === 'India') return 'india';
  if (markets.includes('Forex') || markets.includes('London')) return 'london';
  if (markets.includes('US Futures') || markets.includes('NYSE')) return 'newyork';
  return DEFAULT_REGION;
}

export default async function handler(req, res) {
  // Auth check
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && req.headers['x-vercel-cron'] !== '1') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const region = req.query.region || DEFAULT_REGION;
  const weekLabel = getWeekLabel();
  const weekStart = getWeekStart();
  let sent = 0, skipped = 0, errors = 0;

  try {
    const usersSnap = await db.collection('users').get();

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const userData = userDoc.data();

      // Skip if no email
      if (!userData.email) { skipped++; continue; }

      // Only send to users in this region
      const userRegion = getUserRegion(userData);
      if (userRegion !== region) { skipped++; continue; }

      // Get this week's trades
      const tradesSnap = await db
        .collection('users').doc(uid)
        .collection('trades')
        .where('datetime', '>=', weekStart.toISOString().slice(0, 16))
        .get();

      // Skip users with no trades this week
      if (tradesSnap.empty) { skipped++; continue; }

      const trades = tradesSnap.docs.map(d => d.data());
      const wins = trades.filter(t => t.result === 'Win').length;
      const losses = trades.filter(t => t.result === 'Loss').length;
      const totalPnl = trades.reduce((s, t) => s + (parseFloat(t.pnl) || 0), 0);
      const winRate = Math.round((wins / trades.length) * 100);

      // Top emotion
      const emoCount = {};
      trades.forEach(t => { if (t.preEmo) emoCount[t.preEmo] = (emoCount[t.preEmo] || 0) + 1; });
      const topEmotion = Object.entries(emoCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

      // Get weekly AI report insight if exists
      const weekId = `${weekStart.getFullYear()}-W${String(Math.ceil((weekStart - new Date(weekStart.getFullYear(), 0, 1)) / 604800000 + 1)).padStart(2, '0')}`;
      let insight = '';
      try {
        const reportDoc = await db.collection('users').doc(uid).collection('weeklyReports').doc(weekId).get();
        if (reportDoc.exists) {
          insight = reportDoc.data().report?.slice(0, 280) + '...';
        }
      } catch (e) { /* no report */ }

      try {
        await sendWeeklyEmail({
          email: userData.email,
          name: userData.displayName || userData.email,
          weekLabel,
          stats: {
            trades: trades.length, wins, losses, winRate,
            pnl: totalPnl,
            currency: trades[0]?.currency || '₹',
            streak: userData.streak || 0,
            topEmotion,
            disciplineScore: userData.disciplineScore || '—'
          },
          insight
        });
        sent++;
        await new Promise(r => setTimeout(r, 200));
      } catch (e) {
        console.error(`Failed email for ${uid}:`, e.message);
        errors++;
      }
    }

    console.log(`[${region}] Weekly emails: ${sent} sent, ${skipped} skipped, ${errors} errors`);
    return res.status(200).json({ region, sent, skipped, errors, weekLabel });

  } catch (e) {
    console.error('Cron error:', e);
    return res.status(500).json({ error: e.message });
  }
}
