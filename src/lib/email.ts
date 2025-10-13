// Using Resend for email delivery
// Install: npm install resend
// Set environment variable: RESEND_API_KEY=your_api_key

export async function sendInvitationEmail({
  toEmail,
  toName,
  videoTitle,
  acceptLink,
  inviterName,
  hasAccount,
}: {
  toEmail: string;
  toName: string;
  videoTitle: string;
  acceptLink: string;
  inviterName: string;
  hasAccount: boolean;
}) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured, skipping email send');
    return { success: false, error: 'API key not configured' };
  }

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background-color: #00875F;
          color: white;
          padding: 20px;
          text-align: center;
          border-radius: 5px 5px 0 0;
        }
        .content {
          background-color: #f9f9f9;
          padding: 30px;
          border-radius: 0 0 5px 5px;
        }
        .button {
          display: inline-block;
          padding: 12px 30px;
          background-color: #00875F;
          color: white !important;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
          font-weight: bold;
        }
        .footer {
          text-align: center;
          margin-top: 20px;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎥 Video Invitation</h1>
        </div>
        <div class="content">
          <p>Hi ${toName},</p>
          <p>You have been invited by <strong>${inviterName}</strong> to edit video <strong>"${videoTitle}"</strong>.</p>
          ${hasAccount
            ? '<p>Click the button below to accept the invitation and view the video:</p>'
            : '<p>You need to create an account first. Click the button below to sign up and accept the invitation:</p>'}
          <a href="${acceptLink}" class="button">Accept Invitation</a>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #0066cc;">${acceptLink}</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          <p style="font-size: 14px; color: #666;">
            ${hasAccount
              ? 'Please log in with your account to accept this invitation.'
              : 'You will be asked to create an account before you can view the video.'}
          </p>
        </div>
        <div class="footer">
          <p>This email was sent from Video Commenter</p>
          <p>© ${new Date().getFullYear()} Video Commenter. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const emailText = `
Hi ${toName},

You have been invited by ${inviterName} to edit video "${videoTitle}".

${hasAccount
  ? 'Click the link below to accept the invitation:'
  : 'You need to create an account first. Click the link below to sign up and accept:'}

${acceptLink}

${hasAccount
  ? 'Please log in with your account to accept this invitation.'
  : 'You will be asked to create an account before you can view the video.'}

---
This email was sent from Video Commenter
© ${new Date().getFullYear()} Video Commenter. All rights reserved.
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL || 'Video Commenter <onboarding@resend.dev>',
        to: toEmail,
        subject: `You've been invited to edit "${videoTitle}"`,
        html: emailHtml,
        text: emailText,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(JSON.stringify(error));
    }

    const data = await response.json();
    console.log('Email sent successfully via Resend:', data.id);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Error sending email via Resend:', error);
    return { success: false, error };
  }
}
