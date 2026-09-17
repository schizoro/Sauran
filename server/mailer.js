require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.zoho.com',
  port: 465,
  secure: true,
  auth: {
    user: 'destek@sauran.online',
    pass: process.env.ZOHO_EMAIL_PASSWORD
  }
});

const MAIL_FROM = '"Sauran" <destek@sauran.online>';

async function sendVerificationEmail(toEmail, code) {
  await transporter.sendMail({
    to: toEmail,
    from: MAIL_FROM,
    subject: 'Sauran — E-posta Doğrulama Kodun',
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; background: #0b0c10; color: #c5c6c7; padding: 40px; max-width: 480px; margin: auto; border-radius: 4px;">
        <h2 style="color: #66fcf1; letter-spacing: 2px; text-transform: uppercase;">Sauran</h2>
        <p style="margin-top: 20px;">Doğrulama kodun:</p>
        <div style="font-size: 36px; font-weight: bold; color: #66fcf1; letter-spacing: 8px; margin: 20px 0;">
          ${code}
        </div>
        <p style="color: #45a29e; font-size: 13px;">Bu kod 10 dakika geçerlidir.</p>
      </div>
    `
  });
}

async function sendPasswordResetEmail(toEmail, code) {
  await transporter.sendMail({
    to: toEmail,
    from: MAIL_FROM,
    subject: 'Sauran — Şifre Sıfırlama Kodun',
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; background: #0b0c10; color: #c5c6c7; padding: 40px; max-width: 480px; margin: auto; border-radius: 4px;">
        <h2 style="color: #66fcf1; letter-spacing: 2px; text-transform: uppercase;">Sauran</h2>
        <p style="margin-top: 20px;">Şifre sıfırlama kodun:</p>
        <div style="font-size: 36px; font-weight: bold; color: #66fcf1; letter-spacing: 8px; margin: 20px 0;">
          ${code}
        </div>
        <p style="color: #45a29e; font-size: 13px;">Bu kod 10 dakika geçerlidir. Bu isteği sen yapmadıysan bu maili görmezden gelebilirsin.</p>
      </div>
    `
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
