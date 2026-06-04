// lib/mailer.js
import nodemailer from "nodemailer";

export async function sendDynamicEmail({ to, subject, html }) {
  try {
    const accounts = JSON.parse(process.env.SMTP_ACCOUNTS || "[]");

    if (accounts.length === 0) {
      throw new Error("no smtp accounts found in env.");
    }

    //randomized email pick
    const randomIndex = Math.floor(Math.random() * accounts.length);
    const selectedAccount = accounts[randomIndex];

    console.log(`📧 [SMTP SHUFFLE] Gagamitin ang account na: ${selectedAccount.user} (#${randomIndex + 1})`);

    // 3. Gumawa ng Transporter ON-THE-FLY gamit ang napiling random account
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "465"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: selectedAccount.user,
        pass: selectedAccount.pass,
      },
    });

    // 4. I-set ang mail configuration
    const mailOptions = {
      from: `"SchoolPortal IT Office" <${selectedAccount.user}>`,
      to,
      subject,
      html,
    };

    // 5. Isend na ang email!
    const info = await transporter.sendMail(mailOptions);
    return info;

  } catch (error) {
    console.error("❌ Shuffle Mailer Error:", error);
    throw error;
  }
}