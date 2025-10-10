import nodemailer from 'nodemailer';

// Create a transporter using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail address
    pass: process.env.EMAIL_PASSWORD, // Your Gmail app password
  },
});

export async function sendInvitationEmail({
  toEmail,
  toName,
  videoTitle,
  videoLink,
  inviterName,
}: {
  toEmail: string;
  toName: string;
  videoTitle: string;
  videoLink: string;
  inviterName: string;
}) {
  const mailOptions = {
    from: `"Video Commenter" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `You've been invited to view "${videoTitle}"`,
    html: `
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
            <p><strong>${inviterName}</strong> has invited you to view and comment on the following video:</p>
            <h2 style="color: #00875F;">${videoTitle}</h2>
            <p>Click the button below to access the video:</p>
            <a href="${videoLink}" class="button">View Video</a>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #0066cc;">${videoLink}</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
            <p style="font-size: 14px; color: #666;">
              If you don't have an account yet, you'll need to sign up first to view the video and add comments.
            </p>
          </div>
          <div class="footer">
            <p>This email was sent from Video Commenter</p>
            <p>© ${new Date().getFullYear()} Video Commenter. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Hi ${toName},

${inviterName} has invited you to view and comment on the following video:

${videoTitle}

View the video here: ${videoLink}

If you don't have an account yet, you'll need to sign up first to view the video and add comments.

---
This email was sent from Video Commenter
© ${new Date().getFullYear()} Video Commenter. All rights reserved.
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error };
  }
}
