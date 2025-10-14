// Using cPanel SMTP for email delivery
// Requires nodemailer (already installed)
// Set environment variables in .env.local:
//   SMTP_HOST=mail.yourdomain.com
//   SMTP_PORT=465 (or 587 for TLS)
//   SMTP_USER=your-email@yourdomain.com
//   SMTP_PASSWORD=your-email-password
//   SMTP_FROM=Video Commenter <your-email@yourdomain.com>

import nodemailer from 'nodemailer';

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
  // Check for required SMTP configuration
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    console.warn('SMTP configuration not complete, skipping email send');
    return { success: false, error: 'SMTP not configured' };
  }

  // Create transporter with cPanel SMTP settings
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

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
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: toEmail,
      subject: `You've been invited to edit "${videoTitle}"`,
      html: emailHtml,
      text: emailText,
    });

    console.log('Email sent successfully via cPanel SMTP:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email via cPanel SMTP:', error);
    return { success: false, error };
  }
}
