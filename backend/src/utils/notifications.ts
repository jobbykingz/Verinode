import nodemailer from 'nodemailer';
import twilio from 'twilio';

// Email configuration
const emailTransporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// SMS configuration
const smsClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Send email notification
 */
export async function sendEmail(options: {
  to: string;
  subject: string;
  body: string;
  html?: string;
}): Promise<boolean> {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@verinode.io',
      to: options.to,
      subject: options.subject,
      text: options.body,
      html: options.html || options.body,
    };

    const result = await emailTransporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

/**
 * Send SMS notification
 */
export async function sendSMS(options: {
  to: string;
  body: string;
}): Promise<boolean> {
  try {
    const result = await smsClient.messages.create({
      body: options.body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: options.to,
    });

    console.log('SMS sent successfully:', result.sid);
    return true;
  } catch (error) {
    console.error('Failed to send SMS:', error);
    return false;
  }
}

/**
 * Send multi-signature approval notification
 */
export async function sendMultiSigNotification(options: {
  recipientEmail?: string;
  recipientPhone?: string;
  walletName: string;
  requestId: string;
  requestType: string;
  expiresAt: Date;
}): Promise<void> {
  const subject = `Multi-Signature Approval Required: ${options.requestType}`;
  const body = `
A multi-signature approval is required for wallet "${options.walletName}".

Request Details:
- Request ID: ${options.requestId}
- Type: ${options.requestType}
- Expires: ${options.expiresAt.toLocaleString()}

Please review and approve this request at your earliest convenience.

Best regards,
Verinode Team
  `;

  if (options.recipientEmail) {
    await sendEmail({
      to: options.recipientEmail,
      subject,
      body,
      html: body.replace(/\n/g, '<br>')
    });
  }

  if (options.recipientPhone) {
    const smsBody = `Multi-sig approval needed for ${options.walletName}. Request ID: ${options.requestId}. Expires: ${options.expiresAt.toLocaleString()}`;
    await sendSMS({
      to: options.recipientPhone,
      body: smsBody
    });
  }
}

/**
 * Send recovery notification
 */
export async function sendRecoveryNotification(options: {
  recipientEmail?: string;
  recipientPhone?: string;
  walletName: string;
  recoveryId: string;
  initiatedBy: string;
}): Promise<void> {
  const subject = `Wallet Recovery Process Initiated: ${options.walletName}`;
  const body = `
A recovery process has been initiated for wallet "${options.walletName}".

Recovery Details:
- Recovery ID: ${options.recoveryId}
- Initiated by: ${options.initiatedBy}
- Status: Pending approvals

If you did not initiate this recovery, please contact support immediately.

Best regards,
Verinode Team
  `;

  if (options.recipientEmail) {
    await sendEmail({
      to: options.recipientEmail,
      subject,
      body,
      html: body.replace(/\n/g, '<br>')
    });
  }

  if (options.recipientPhone) {
    const smsBody = `Recovery initiated for wallet ${options.walletName}. Recovery ID: ${options.recoveryId}. Contact support if not authorized.`;
    await sendSMS({
      to: options.recipientPhone,
      body: smsBody
    });
  }
}

/**
 * Send security alert
 */
export async function sendSecurityAlert(options: {
  recipientEmail?: string;
  recipientPhone?: string;
  walletName: string;
  alertType: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}): Promise<void> {
  const subject = `Security Alert: ${options.alertType} - ${options.walletName}`;
  const severityEmoji = options.severity === 'HIGH' ? '🔴' : options.severity === 'MEDIUM' ? '🟡' : '🟢';
  
  const body = `
${severityEmoji} Security Alert Detected

Wallet: ${options.walletName}
Alert Type: ${options.alertType}
Severity: ${options.severity}
Description: ${options.description}

Time: ${new Date().toLocaleString()}

Please review this activity and take appropriate action if necessary.

Best regards,
Verinode Security Team
  `;

  if (options.recipientEmail) {
    await sendEmail({
      to: options.recipientEmail,
      subject,
      body,
      html: body.replace(/\n/g, '<br>')
    });
  }

  if (options.recipientPhone && options.severity !== 'LOW') {
    const smsBody = `Security Alert: ${options.alertType} detected for wallet ${options.walletName}. Severity: ${options.severity}. Please review immediately.`;
    await sendSMS({
      to: options.recipientPhone,
      body: smsBody
    });
  }
}
