// api/send-weekly-email.js
// Sends weekly journal summary email via Resend

export default async function sendWeeklyEmail({ email, name, stats, insight, weekLabel }) {
  const {
    trades = 0, wins = 0, losses = 0,
    winRate = 0, pnl = 0, currency = '₹',
    streak = 0, topEmotion = '—', disciplineScore = '—'
  } = stats;

  const pnlFormatted = `${pnl >= 0 ? '+' : ''}${currency}${Math.abs(pnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const pnlColor = pnl >= 0 ? '#00F5A0' : '#FF4D6D';
  const firstName = name?.split(' ')[0] || 'Trader';

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#060816;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#060816;padding:40px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

  <!-- Header -->
  <tr><td style="padding-bottom:32px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><span style="font-weight:900;font-size:24px;color:#F1F5F9;letter-spacing:-0.05em;"><span style="color:#00F5A0;">V</span>yxor</span></td>
      <td align="right"><span style="font-size:11px;font-family:'Courier New',monospace;color:#475569;text-transform:uppercase;letter-spacing:0.1em;">Weekly Journal Summary</span></td>
    </tr></table>
  </td></tr>

  <!-- Week label -->
  <tr><td style="padding-bottom:8px;">
    <span style="font-size:12px;font-family:'Courier New',monospace;color:#475569;text-transform:uppercase;letter-spacing:0.1em;">${weekLabel}</span>
  </td></tr>

  <!-- Headline -->
  <tr><td style="padding-bottom:32px;">
    <h1 style="margin:0;font-size:28px;font-weight:800;color:#F1F5F9;letter-spacing:-0.03em;line-height:1.1;">Your week in review,<br>${firstName}.</h1>
  </td></tr>

  <!-- Stats -->
  <tr><td style="padding-bottom:24px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="22%" style="padding:16px;background:#0B1220;border:1px solid rgba(255,255,255,0.07);border-radius:12px;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:${pnlColor};letter-spacing:-0.03em;">${pnlFormatted}</div>
        <div style="font-size:11px;color:#475569;font-family:'Courier New',monospace;margin-top:4px;text-transform:uppercase;">P&L</div>
      </td>
      <td width="4%"></td>
      <td width="22%" style="padding:16px;background:#0B1220;border:1px solid rgba(255,255,255,0.07);border-radius:12px;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:#00F5A0;letter-spacing:-0.03em;">${winRate}%</div>
        <div style="font-size:11px;color:#475569;font-family:'Courier New',monospace;margin-top:4px;text-transform:uppercase;">Win Rate</div>
      </td>
      <td width="4%"></td>
      <td width="22%" style="padding:16px;background:#0B1220;border:1px solid rgba(255,255,255,0.07);border-radius:12px;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:#F1F5F9;letter-spacing:-0.03em;">${trades}</div>
        <div style="font-size:11px;color:#475569;font-family:'Courier New',monospace;margin-top:4px;text-transform:uppercase;">Trades</div>
      </td>
      <td width="4%"></td>
      <td width="22%" style="padding:16px;background:#0B1220;border:1px solid rgba(255,255,255,0.07);border-radius:12px;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:#a78bfa;letter-spacing:-0.03em;">${streak}</div>
        <div style="font-size:11px;color:#475569;font-family:'Courier New',monospace;margin-top:4px;text-transform:uppercase;">Streak</div>
      </td>
    </tr></table>
  </td></tr>

  <!-- AI Insight -->
  ${insight ? `<tr><td style="padding-bottom:24px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="padding:20px 24px;background:rgba(0,245,160,0.05);border:1px solid rgba(0,245,160,0.15);border-radius:12px;">
        <div style="font-size:11px;font-family:'Courier New',monospace;color:#00F5A0;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">Journal AI · This week</div>
        <div style="font-size:14px;color:#94A3B8;line-height:1.7;">${insight}</div>
      </td>
    </tr></table>
  </td></tr>` : ''}

  <!-- Breakdown -->
  <tr><td style="padding-bottom:24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0B1220;border:1px solid rgba(255,255,255,0.07);border-radius:12px;">
      <tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.07);">
        <span style="font-size:13px;font-weight:600;color:#F1F5F9;">This week's breakdown</span>
      </td></tr>
      <tr><td style="padding:12px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
        <table width="100%"><tr>
          <td style="font-size:13px;color:#94A3B8;">Winning trades</td>
          <td align="right" style="font-size:13px;color:#00F5A0;font-family:'Courier New',monospace;">${wins}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:12px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
        <table width="100%"><tr>
          <td style="font-size:13px;color:#94A3B8;">Losing trades</td>
          <td align="right" style="font-size:13px;color:#FF4D6D;font-family:'Courier New',monospace;">${losses}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:12px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
        <table width="100%"><tr>
          <td style="font-size:13px;color:#94A3B8;">Most common emotion</td>
          <td align="right" style="font-size:13px;color:#F1F5F9;font-family:'Courier New',monospace;">${topEmotion}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:12px 20px;">
        <table width="100%"><tr>
          <td style="font-size:13px;color:#94A3B8;">Discipline score</td>
          <td align="right" style="font-size:13px;color:#a78bfa;font-family:'Courier New',monospace;">${disciplineScore}/100</td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td style="padding-bottom:32px;text-align:center;">
    <a href="https://vyxor.in/journal" style="display:inline-block;padding:14px 32px;background:#00F5A0;color:#060816;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">Open Your Journal</a>
  </td></tr>

  <!-- Footer -->
  <tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding-top:24px;">
    <p style="margin:0;font-size:11px;color:#334155;font-family:'Courier New',monospace;line-height:1.7;text-align:center;">
      Vyxor · vyxor.in<br>
      Weekly journal summary based only on trades you logged yourself.<br>
      Not financial advice. Not investment recommendations.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Vyxor <hello@vyxor.in>',
      to: [email],
      subject: `Your week in review — ${weekLabel}`,
      html
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to send email');
  }

  return await res.json();
}
