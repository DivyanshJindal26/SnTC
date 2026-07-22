import nodemailer from 'nodemailer';

const smtpConfigured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

if (!smtpConfigured) {
  console.warn('[email] SMTP not configured — registration emails will be skipped');
}

export async function sendRegistrationEmail({ to, studentName, sessionTitle, sessionDate, venue, qrBuffer, siteUrl }) {
  if (!transporter) return;

  const dateStr = new Date(sessionDate).toLocaleString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const registerUrl = `${siteUrl}/register/`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: `Registration Confirmed — ${sessionTitle}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:8px;border:1px solid #dde3ec;overflow:hidden;">
    <div style="background:#163a7d;padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600;">SnTC · IIT Mandi</h1>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px;color:#121821;font-size:16px;">
        Hi <strong>${esc(studentName)}</strong>,
      </p>
      <p style="margin:0 0 24px;color:#55606f;line-height:1.6;">
        You're registered for <strong style="color:#163a7d;">${esc(sessionTitle)}</strong>.
        Show this QR code at the venue for priority check-in.
      </p>

      <div style="text-align:center;margin:0 0 24px;">
        <img src="cid:qrcode" alt="Check-in QR Code" width="240" height="240"
             style="border:1px solid #eaeff5;border-radius:8px;" />
      </div>

      <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
        <tr>
          <td style="padding:8px 0;color:#7c8593;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;border-bottom:1px solid #eaeff5;">When</td>
          <td style="padding:8px 0;color:#121821;font-size:15px;border-bottom:1px solid #eaeff5;">${dateStr}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#7c8593;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;border-bottom:1px solid #eaeff5;">Where</td>
          <td style="padding:8px 0;color:#121821;font-size:15px;border-bottom:1px solid #eaeff5;">${esc(venue)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#7c8593;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Priority</td>
          <td style="padding:8px 0;color:#121821;font-size:15px;">Entry opens <strong>15 min</strong> before session</td>
        </tr>
      </table>

      <p style="margin:0 0 8px;color:#55606f;font-size:13px;">
        Can't see the QR? <a href="${registerUrl}" style="color:#163a7d;">View it on the registration page</a>.
      </p>
      <p style="margin:0;color:#7c8593;font-size:12px;">
        To cancel, visit the registration page and click "Cancel registration".
      </p>
    </div>
    <div style="background:#f5f7fa;padding:16px 32px;border-top:1px solid #eaeff5;">
      <p style="margin:0;color:#7c8593;font-size:12px;text-align:center;">
        Science and Technology Council · IIT Mandi · Kamand, Himachal Pradesh
      </p>
    </div>
  </div>
</body>
</html>`.trim(),
    attachments: [{
      filename: 'checkin-qr.png',
      content: qrBuffer,
      cid: 'qrcode',
    }],
  });
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
