import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendWelcomeEmail({
  to,
  restaurantName,
  slug,
}: {
  to: string;
  restaurantName: string;
  slug: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const menuUrl = `${appUrl}/${slug}`;
  const dashboardUrl = `${appUrl}/dashboard`;

  await resend.emails.send({
    from: 'MenuQR <noreply@yourdomain.com>',
    to,
    subject: `Your digital menu is ready — ${restaurantName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <body style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 16px; color: #111;">
          <h1 style="font-size: 24px; font-weight: 900; margin-bottom: 8px;">
            Welcome to MenuQR! 🎉
          </h1>
          <p style="color: #555; margin-bottom: 24px;">
            Your restaurant <strong>${restaurantName}</strong> is live. Here's everything you need to get started.
          </p>

          <div style="background: #f9f9f9; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 12px; font-weight: 700;">Your menu link:</p>
            <a href="${menuUrl}" style="color: #e94560; font-size: 15px; word-break: break-all;">
              ${menuUrl}
            </a>
          </div>

          <p style="color: #555; margin-bottom: 24px;">
            Share this link or generate QR codes for your tables from the dashboard.
          </p>

          <a
            href="${dashboardUrl}"
            style="display: inline-block; background: #e94560; color: white; padding: 12px 28px;
                   border-radius: 8px; font-weight: 700; text-decoration: none; font-size: 15px;"
          >
            Go to Dashboard →
          </a>

          <hr style="margin: 32px 0; border: none; border-top: 1px solid #eee;" />

          <p style="font-size: 12px; color: #aaa;">
            You're receiving this because you signed up at MenuQR.
          </p>
        </body>
      </html>
    `,
  });
}
