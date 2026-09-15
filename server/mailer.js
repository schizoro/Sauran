require('dotenv').config();
const dns = require('dns');
const nodemailer = require('nodemailer');

// Bazı barındırma ortamları (ör. Render'ın ücretsiz katmanı) IPv6 çıkışını
// desteklemiyor. Gmail'in SMTP sunucusu IPv6 adresi döndürdüğünde bağlantı
// "ENETUNREACH" ile düşüyordu — IPv4'ü önceliklendirerek bunu önlüyoruz.
dns.setDefaultResultOrder('ipv4first');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  },
  family: 4,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000
});

async function sendVerificationEmail(toEmail, code) {
  await transporter.sendMail({
    from: `"Sauran" <${process.env.MAIL_USER}>`,
    to: toEmail,
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

module.exports = { sendVerificationEmail };