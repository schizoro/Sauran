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

// Moderasyon ekibine yeni rapor bildirimi. Hedef adres .env üzerinden
// REPORT_EMAIL_TO ile yapılandırılabilir; ayarlanmamışsa zaten SMTP
// hesabı olarak kullanılan destek@sauran.online'a düşer (yeni bir
// sağlayıcı/kimlik icat edilmiyor, mevcut, doğrulanmış Zoho hesabı
// kullanılıyor).
const REPORT_EMAIL_TO = process.env.REPORT_EMAIL_TO || 'destek@sauran.online';

function describeReportContext(report) {
  const ctx = report.target_context;
  if (!ctx || !ctx.exists) return 'Hedef bulunamadı (silinmiş olabilir).';

  if (report.target_type === 'user') return `Kullanıcı: ${ctx.username} (#${ctx.user_id})`;
  if (report.target_type === 'hub') return `Hub: ${ctx.hub_name} (sahibi: ${ctx.owner_username || 'bilinmiyor'})`;
  if (report.target_type === 'voice_room') return `Sesli Oda: ${ctx.room_name} — Hub: ${ctx.hub_name || 'bilinmiyor'}`;
  if (report.target_type === 'message') {
    const where = ctx.context?.type === 'hub'
      ? `Hub: ${ctx.context.hub_name || 'bilinmiyor'}`
      : 'Özel Mesaj (DM)';
    return `Mesaj gönderen: ${ctx.sender_username} — ${where}\nİçerik: ${String(ctx.content || '').slice(0, 200)}`;
  }
  return `${report.target_type} #${report.target_id}`;
}

async function sendReportNotificationEmail(report) {
  const priorityLabel = String(report.priority || 'normal').toUpperCase();

  await transporter.sendMail({
    to: REPORT_EMAIL_TO,
    from: MAIL_FROM,
    subject: `[SAURAN] Yeni Rapor #${report.id} — ${priorityLabel}`,
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; background: #0b0c10; color: #c5c6c7; padding: 32px; max-width: 560px; margin: auto; border-radius: 4px;">
        <h2 style="color: #66fcf1; letter-spacing: 1px;">Yeni Moderasyon Raporu #${report.id}</h2>
        <table style="width:100%; border-collapse: collapse; font-size: 13px; margin-top: 16px;">
          <tr><td style="padding:4px 0; color:#45a29e;">Öncelik</td><td>${priorityLabel}</td></tr>
          <tr><td style="padding:4px 0; color:#45a29e;">Kategori</td><td>${report.reason}</td></tr>
          <tr><td style="padding:4px 0; color:#45a29e;">Hedef türü</td><td>${report.target_type}</td></tr>
          <tr><td style="padding:4px 0; color:#45a29e;">Bildiren</td><td>${report.reporter_username}</td></tr>
          <tr><td style="padding:4px 0; color:#45a29e;">Bağlam</td><td style="white-space:pre-wrap;">${describeReportContext(report)}</td></tr>
          <tr><td style="padding:4px 0; color:#45a29e;">Açıklama</td><td>${report.description ? String(report.description).slice(0, 300) : '—'}</td></tr>
          <tr><td style="padding:4px 0; color:#45a29e;">Tarih</td><td>${report.created_at}</td></tr>
        </table>
        <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">İncelemek için moderasyon paneline giriş yap.</p>
      </div>
    `
  });
}

// Resmi yönetim görevi e-postaları (görev verildi / görevden alındı). Metinler bir
// hukuki sözleşme değildir; Sauran yönetim politikalarına dayalı bilgilendirmedir.
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const ROLE_LABELS_TR = { moderator: 'Moderator', admin: 'Admin', user: 'Kullanıcı' };

async function sendRoleNoticeEmail({ toEmail, username, type, role, payload, date }) {
  const roleLabel = ROLE_LABELS_TR[role] || role;
  const when = escapeHtml(String(date || '').slice(0, 16).replace('T', ' ') || '—');
  const wrapStart = `<div style="font-family: 'Segoe UI', sans-serif; background: #0b0c10; color: #c5c6c7; padding: 36px; max-width: 520px; margin: auto; border-radius: 4px;">
        <h2 style="color: #66fcf1; letter-spacing: 2px; text-transform: uppercase;">Sauran Yönetim</h2>
        <p style="margin-top: 20px;">Merhaba ${escapeHtml(username)},</p>`;
  const wrapEnd = `<p style="color: #6b7280; font-size: 12px; margin-top: 24px;">Bu e-posta Sauran Yönetim tarafından otomatik gönderilmiştir. Destek: destek@sauran.online</p>
      </div>`;

  if (type === 'revoked') {
    const removed = ROLE_LABELS_TR[payload?.removed_role] || roleLabel;
    const current = ROLE_LABELS_TR[payload?.current_role] || 'Kullanıcı';
    await transporter.sendMail({
      to: toEmail,
      from: MAIL_FROM,
      subject: 'Sauran — Yönetim Göreviniz Sona Erdirilmiştir',
      html: `${wrapStart}
        <p><strong style="color:#e2f8f6;">Yönetim göreviniz sona erdirilmiştir.</strong></p>
        <table style="font-size: 13px; border-collapse: collapse;">
          <tr><td style="padding:3px 12px 3px 0; color:#45a29e;">Kaldırılan görev</td><td>${escapeHtml(removed)}</td></tr>
          <tr><td style="padding:3px 12px 3px 0; color:#45a29e;">Güncel rol</td><td>${escapeHtml(current)}</td></tr>
          <tr><td style="padding:3px 12px 3px 0; color:#45a29e;">İşlemi yapan</td><td>Founder (Sauran Yönetim)</td></tr>
          <tr><td style="padding:3px 12px 3px 0; color:#45a29e;">Tarih</td><td>${when}</td></tr>
        </table>
        <p style="font-size: 13px;">Bu bilgilendirme için herhangi bir onay gerekmez. Sorularınız için destek@sauran.online adresine yazabilirsiniz.</p>
      ${wrapEnd}`
    });
    return;
  }

  const intro = role === 'admin'
    ? 'Sauran yönetiminde <strong style="color:#e2f8f6;">Admin</strong> olarak görevlendirildiniz. Bu görev, moderatörlerden daha geniş platform yetkileri ve sorumlulukları içerir.'
    : 'Sauran yönetiminde <strong style="color:#e2f8f6;">Moderator</strong> olarak görevlendirildiniz. Bu görev, topluluk güvenliği ve kurallarına uyum konusunda sorumluluk içerir.';
  await transporter.sendMail({
    to: toEmail,
    from: MAIL_FROM,
    subject: `Sauran — Yönetim Görevi Bildirimi (${roleLabel})`,
    html: `${wrapStart}
        <p>${intro}</p>
        <p style="font-size: 13px;">Görev bildiriminin tamamını okuyup kabul edebilmeniz için Sauran'a giriş yapmanız gerekir. <strong>Kabul edilene kadar yeni yönetim yetkileri etkin olmaz.</strong></p>
        <p style="font-size: 12px; color:#45a29e;">Tarih: ${when}</p>
      ${wrapEnd}`
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendReportNotificationEmail, sendRoleNoticeEmail };
