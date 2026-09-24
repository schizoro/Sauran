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

// Rapor bildirim e-postası bilerek MİNİMUMDUR: yalnızca yeni bir rapor açıldığını, rapor numarasını, kategorisini ve önceliğini
// bildirir ve kimlik doğrulaması gerektiren moderasyon paneline yönlendirir. Mesaj içeriği, medya, kullanıcı adı, e-posta, rapor
// açıklaması ya da başka kullanıcı verisi İÇERMEZ: e-posta, kanıt saklama (retention) sisteminin dışında süresiz bir kopya oluşturmamalıdır.
// HTML'e girebilen her değer sabit bir beyaz listeden (etiket tabloları) ya da tam sayıdan gelir; kullanıcıdan gelen serbest metin
// hiçbir yerde render edilmez.
const PANEL_URL = `${String(process.env.PUBLIC_BASE_URL || 'https://sauran.online').replace(/\/+$/, '')}/moderation.html`;

const REPORT_REASON_LABELS = {
  harassment: 'Taciz / Rahatsız Etme', threat: 'Tehdit', spam: 'Spam', scam: 'Dolandırıcılık',
  inappropriate: 'Uygunsuz içerik', hate: 'Nefret / Ayrımcılık', child_safety: 'Çocuk güvenliği',
  impersonation: 'Sahte hesap / Taklit', other: 'Diğer'
};
const REPORT_TARGET_LABELS = { message: 'İleti', user: 'Kullanıcı', hub: 'Lobi', voice_room: 'Sesli oda' };
const REPORT_PRIORITY_LABELS = { normal: 'NORMAL', high: 'YÜKSEK', critical: 'KRİTİK' };

async function sendReportNotificationEmail(report) {
  const reportId = Number.parseInt(report && report.id, 10) || 0;
  const priorityLabel = REPORT_PRIORITY_LABELS[report && report.priority] || REPORT_PRIORITY_LABELS.normal;
  const reasonLabel = REPORT_REASON_LABELS[report && report.reason] || REPORT_REASON_LABELS.other;
  const targetLabel = REPORT_TARGET_LABELS[report && report.target_type] || 'Diğer';

  await transporter.sendMail({
    to: REPORT_EMAIL_TO,
    from: MAIL_FROM,
    subject: `[SAURAN] Yeni Rapor #${reportId} — ${priorityLabel}`,
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; background: #0b0c10; color: #c5c6c7; padding: 32px; max-width: 560px; margin: auto; border-radius: 4px;">
        <h2 style="color: #66fcf1; letter-spacing: 1px;">Yeni Moderasyon Raporu #${reportId}</h2>
        <table style="width:100%; border-collapse: collapse; font-size: 13px; margin-top: 16px;">
          <tr><td style="padding:4px 0; color:#45a29e;">Öncelik</td><td>${priorityLabel}</td></tr>
          <tr><td style="padding:4px 0; color:#45a29e;">Kategori</td><td>${reasonLabel}</td></tr>
          <tr><td style="padding:4px 0; color:#45a29e;">Hedef türü</td><td>${targetLabel}</td></tr>
        </table>
        <p style="margin-top: 20px;">Yeni bir rapor oluşturuldu. Ayrıntılar bu e-postada yer almaz; incelemek için moderasyon paneline giriş yapın:</p>
        <p><a href="${PANEL_URL}" style="color: #66fcf1;">${PANEL_URL}</a></p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">Panel giriş gerektirir. Bu e-posta rapor içeriği, kullanıcı adı veya açıklama içermez.</p>
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

// Moderasyon ekibine kısa bilgilendirme: bir kullanıcı yönetim görevini kabul etti / reddetti.
// Alıcı REPORT_EMAIL_TO (yoksa destek@sauran.online). Kullanıcının e-posta adresi eklenmez.
async function sendRoleDecisionTeamEmail({ username, userId, decision, role, version, resultRole, date }) {
  const accepted = decision === 'accepted';
  const roleLabel = ROLE_LABELS_TR[role] || role;
  const resultLabel = ROLE_LABELS_TR[resultRole] || resultRole;
  const when = escapeHtml(String(date || '').slice(0, 16).replace('T', ' ') || '—');

  await transporter.sendMail({
    to: REPORT_EMAIL_TO,
    from: MAIL_FROM,
    subject: `[SAURAN] Yönetim Görevi ${accepted ? 'Kabul Edildi' : 'Reddedildi'} — ${roleLabel}`, // konu satırında kullanıcı adı yok (posta günlükleri/bildirimlerine sızmasın); kimlik gövdede
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; background: #0b0c10; color: #c5c6c7; padding: 32px; max-width: 520px; margin: auto; border-radius: 4px;">
        <h2 style="color: ${accepted ? '#57f287' : '#ff6b7d'}; letter-spacing: 1px;">Yönetim Görevi ${accepted ? 'Kabul Edildi' : 'Reddedildi'}</h2>
        <table style="font-size: 13px; border-collapse: collapse; margin-top: 12px;">
          <tr><td style="padding:3px 14px 3px 0; color:#45a29e;">Kullanıcı</td><td>Hesap #${escapeHtml(userId)}</td></tr>
          <tr><td style="padding:3px 14px 3px 0; color:#45a29e;">Görev</td><td>${escapeHtml(roleLabel)}</td></tr>
          <tr><td style="padding:3px 14px 3px 0; color:#45a29e;">Bildirim sürümü</td><td>${escapeHtml(version)}</td></tr>
          <tr><td style="padding:3px 14px 3px 0; color:#45a29e;">Karar</td><td>${accepted ? 'Kabul etti' : 'Reddetti'}</td></tr>
          <tr><td style="padding:3px 14px 3px 0; color:#45a29e;">Güncel rol</td><td>${escapeHtml(resultLabel)}</td></tr>
          <tr><td style="padding:3px 14px 3px 0; color:#45a29e;">Tarih</td><td>${when}</td></tr>
        </table>
        <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">Sauran tarafından otomatik gönderilmiştir. Ayrıntı için Audit Log'a bakın.</p>
      </div>
    `
  });
}

// E-posta numaralandırmayı önlemek için kayıt ekranı adres kayıtlı olsa da aynı yanıtı verir; kayıtlı adrese bilgi e-postası gider (kod içermez).
async function sendAccountExistsEmail(toEmail) {
  await transporter.sendMail({
    to: toEmail,
    from: MAIL_FROM,
    subject: 'Sauran — Bu e-posta ile bir hesabın zaten var',
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; background: #0b0c10; color: #c5c6c7; padding: 40px; max-width: 480px; margin: auto; border-radius: 12px;">
        <h2 style="color: #66fcf1; letter-spacing: 2px; text-transform: uppercase;">Sauran</h2>
        <p style="margin-top: 20px;">Bu e-posta adresiyle Sauran'a kayıt olunmaya çalışıldı, ancak bu adres için zaten bir hesap var.</p>
        <p>Hesabına giriş yapabilir ya da şifreni unuttuysan giriş ekranındaki "Şifremi unuttum" bağlantısını kullanabilirsin. Bu isteği sen yapmadıysan bu e-postayı görmezden gelebilirsin.</p>
      </div>
    `
  });
}

// Hareketsiz hesap uyarısı: hesap 30 gün içinde silinecek; giriş yapılırsa sayaç sıfırlanır.
async function sendInactivityWarningEmail(toEmail, deleteOnDate) {
  await transporter.sendMail({
    to: toEmail,
    from: MAIL_FROM,
    subject: 'Sauran — Hesabın uzun süredir kullanılmıyor',
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; background: #0b0c10; color: #c5c6c7; padding: 40px; max-width: 480px; margin: auto; border-radius: 12px;">
        <h2 style="color: #66fcf1; letter-spacing: 2px; text-transform: uppercase;">Sauran</h2>
        <p style="margin-top: 20px;">Sauran hesabın uzun süredir (yaklaşık 2 yıl) kullanılmıyor.</p>
        <p>Kişisel verilerini gereğinden uzun tutmamak için, hesabın <strong>${escapeHtml(deleteOnDate)}</strong> tarihinde otomatik olarak silinecek. Hesabını tutmak istiyorsan bu tarihten önce giriş yapman yeterlidir.</p>
        <p style="color: #45a29e; font-size: 13px;">Bu e-postayı beklemiyorsan görmezden gelebilirsin.</p>
      </div>
    `
  });
}

module.exports = { sendInactivityWarningEmail, sendAccountExistsEmail, sendVerificationEmail, sendPasswordResetEmail, sendReportNotificationEmail, sendRoleNoticeEmail, sendRoleDecisionTeamEmail };
