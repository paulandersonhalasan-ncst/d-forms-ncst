import nodemailer from 'nodemailer';

// ✅ Parse SMTP accounts from environment variable
let SMTP_ACCOUNTS = [];
try {
  SMTP_ACCOUNTS = JSON.parse(process.env.SMTP_ACCOUNTS || '[]');
} catch (error) {
  console.error('❌ Failed to parse SMTP_ACCOUNTS:', error.message);
  console.warn('⚠️ Using empty SMTP_ACCOUNTS array. Email sending will fail.');
  SMTP_ACCOUNTS = [];
}

let currentAccountIndex = 0;

function getNextEmailAccount() {
  if (SMTP_ACCOUNTS.length === 0) {
    throw new Error('No SMTP accounts configured');
  }
  const account = SMTP_ACCOUNTS[currentAccountIndex];
  currentAccountIndex = (currentAccountIndex + 1) % SMTP_ACCOUNTS.length;

  console.log(account);
  
  return account;
}

function createTransporter() {
  const account = getNextEmailAccount();
  
  return nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: account.user,
    pass: account.pass,
  },
});
}

export async function sendEmailWithRetry(options, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const transporter = createTransporter();
      const account = SMTP_ACCOUNTS[currentAccountIndex === 0 ? SMTP_ACCOUNTS.length - 1 : currentAccountIndex - 1];
      
      await transporter.sendMail({
        from: `"NCST D-Forms" <${account.user}>`,
        to: options.to,
        subject: options.subject,
        text: options.text || options.html.replace(/<[^>]*>/g, ''),
        html: options.html,
      });
      
      console.log(`✅ Email sent using ${account.user}`);
      return true;
    } catch (error) {
      console.error(`❌ Email attempt ${attempt + 1} failed:`, error);
      if (attempt === retries) return false;
      getNextEmailAccount(); // Lumipat sa susunod na account
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return false;
}

export async function sendPasswordResetEmail(email, resetLink) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #1a3a5c;">NCST D-Forms</h2>
      <h3 style="color: #333;">Password Reset Request</h3>
      
      <p>Hello,</p>
      
      <p>We received a request to reset your password for your NCST D-Forms account.</p>
      
      <p>Click the button below to reset your password:</p>
      
      <div style="text-align: center; margin: 24px 0;">
        <a href="${resetLink}" style="background-color: #1a3a5c; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
          Reset Password
        </a>
      </div>
      
      <p style="color: #666; font-size: 13px;">
        This link will expire in <strong>1 hour</strong>.
      </p>
      
      <p style="color: #666; font-size: 13px;">
        If you did not request this password reset, please ignore this email or contact your system administrator immediately.
      </p>
      
      <hr style="border: 1px solid #e0e0e0; margin: 20px 0;" />
      
      <p style="color: #666; font-size: 12px;">
        This is an automated message. Please do not reply to this email.
      </p>
    </div>
  `;

  return sendEmailWithRetry({
    to: email,
    subject: '🔐 NCST D-Forms - Password Reset',
    html,
  });
}