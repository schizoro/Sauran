// Sunucu hata mesajlarının İngilizcesi. Sunucu Türkçe gönderir; arayüz İngilizceyse ekrana yazılmadan önce çevrilir.
// Tüm API yanıtlarındaki `error` alanı tek noktada (Response.json) çevrilir; socket hataları ve bildirimler showToast'ta.
// Listede olmayan metin olduğu gibi (Türkçe) kalır — yeni hata eklenince buraya da eklenmeli.
(function () {
    'use strict';
    const MAP = {
        // Oturum / giriş / kayıt
        'Oturum bulunamadı.': 'Session not found. Please sign in again.',
        'Oturum doğrulanamadı.': 'Could not verify your session.',
        'Kullanıcı adı/e-posta ve şifre gerekli.': 'Username/email and password are required.',
        'Kullanıcı adı/e-posta veya şifre hatalı.': 'Incorrect username/email or password.',
        'Kullanıcı adı veya şifre hatalı.': 'Incorrect username or password.',
        'Giriş sırasında bir hata oluştu.': 'Something went wrong while signing in.',
        'Kayıt sırasında bir hata oluştu.': 'Something went wrong while signing up.',
        'Hesabınız geçici olarak askıya alındı.': 'Your account has been temporarily suspended.',
        'Kullanıcı adı 3-20 karakter olmalıdır.': 'Username must be 3–20 characters.',
        'Bu kullanıcı adı zaten alınmış.': 'This username is already taken.',
        'Şifre doğru değil.': 'Incorrect password.',
        'Mevcut şifre yanlış.': 'Your current password is incorrect.',
        'Hesabı silmek için mevcut şifreni doğru girmelisin.': 'Enter your current password correctly to delete your account.',
        'Kod doğru değil.': 'The code is incorrect.',
        'Geçersiz kod.': 'Invalid code.',
        'Kodun süresi dolmuş. Tekrar kayıt ol.': 'The code has expired. Please sign up again.',
        'Çok fazla hatalı deneme. Tekrar kayıt ol.': 'Too many wrong attempts. Please sign up again.',
        'Kayıt alınamadı.': 'Could not complete sign-up.',
        'İki adımlı doğrulama zaten açık.': 'Two-step verification is already on.',
        'Geçerli bir e-posta adresi girin.': 'Enter a valid email address.',
        'Geçerli bir e-posta adresi gir.': 'Enter a valid email address.',
        'E-posta değiştirilemedi.': 'Could not change your email.',
        'Bu zaten şu anki e-posta adresin.': 'This is already your current email.',
        'Bu e-posta adresi kullanılamıyor.': 'This email address can’t be used.',
        // Genel
        'Bir hata oluştu.': 'Something went wrong.',
        'Güncellenemedi.': 'Could not update.',
        'Kaydedilemedi.': 'Could not save.',
        'Silinemedi.': 'Could not delete.',
        'Yüklenemedi.': 'Could not load.',
        'Eklenemedi.': 'Could not add.',
        'Alınamadı.': 'Could not fetch.',
        'Gönderilemedi.': 'Could not send.',
        'Katılınamadı.': 'Could not join.',
        'Yanıtlanamadı.': 'Could not reply.',
        'Uygulanamadı.': 'Could not apply.',
        'İşaretlenemedi.': 'Could not mark.',
        'İstek gönderilemedi.': 'Could not send the request.',
        'Düzenlenemedi.': 'Could not edit.',
        'Değişiklik yok.': 'No changes.',
        'Bu işlem için yetkin yok.': "You don't have permission to do this.",
        'Geçersiz süre.': 'Invalid duration.',
        'Geçersiz kullanıcı ID.': 'Invalid user ID.',
        'Geçersiz durum.': 'Invalid status.',
        'Geçersiz seçim.': 'Invalid choice.',
        'Geçersiz görsel.': 'Invalid image.',
        'Geçersiz görsel formatı.': 'Invalid image format.',
        'Geçersiz ses formatı.': 'Invalid audio format.',
        'Geçersiz emoji.': 'Invalid emoji.',
        'Geçersiz Atmosphere.': 'Invalid Atmosphere.',
        'Görsel çok büyük.': 'The image is too large.',
        'Bağlantı yazılamaz.': "Links aren't allowed here.",
        'Başlık boş olamaz.': "Title can't be empty.",
        'Bilinmeyen ürün.': 'Unknown product.',
        'Kullanıcı bulunamadı.': 'User not found.',
        'Kullanıcı bilgisi alınamadı.': 'Could not fetch user info.',
        // Lobi / kanal / ses
        'Lobi bulunamadı.': 'Lobby not found.',
        'Lobi alınamadı.': 'Could not fetch the lobby.',
        'Lobi oluşturulamadı.': 'Could not create the lobby.',
        'Lobi adı 3-40 karakter olmalıdır.': 'Lobby name must be 3–40 characters.',
        "Bu Lobi'nin üyesi değilsin.": "You're not a member of this lobby.",
        "Bu Lobi'a üye değilsin.": "You're not a member of this lobby.",
        "Bu Lobi'a üye değilsin. Önce bir davet koduyla katılmalısın.": "You're not a member of this lobby. Join with an invite code first.",
        "Kullanıcı bu Lobi'ın üyesi değil.": 'This user is not a member of this lobby.',
        "Bu Lobi'ye zaten üyesin.": "You're already a member of this lobby.",
        "Bu Lobi'a zaten üyesin.": "You're already a member of this lobby.",
        "Bu Lobi'dan banlandın.": "You've been banned from this lobby.",
        "Bu Lobi'a katılamazsın.": "You can't join this lobby.",
        "Bu kişi zaten Lobi'a üye.": 'This person is already a member of the lobby.',
        "Kendi Lobi'ını bildiremezsin.": "You can't report your own lobby.",
        "Kullanım Şartları ve Gizlilik Politikası'nı kabul etmelisin.": 'You must accept the Terms of Use and Privacy Policy.',
        "Hareketli emoji Sauran Premium'a özeldir.": 'Animated emojis are a Sauran Premium feature.',
        "Hareketli çıkartma Sauran Premium'a özeldir.": 'Animated stickers are a Sauran Premium feature.',
        "Yeterli Sauran Coin'in yok. Coin satın alma yakında.": "You don't have enough Sauran Coins. Buying coins is coming soon.",
        "Bu özellik Seviye 4'te açılır.": 'This feature unlocks at lobby Level 4.',
        'Kullanıcı bu Lobi üyesi değil.': 'This user is not a member of this lobby.',
        'Bu işlem için Lobi yetkin yok.': "You don't have lobby permission for this.",
        'Sadece Lobi sahibi değiştirebilir.': 'Only the lobby owner can change this.',
        'Bu işlem gruplarda kullanılamaz.': "This isn't available in groups.",
        'Bu grubun üyesi değilsin.': "You're not a member of this group.",
        'Bu davet kodu kullanım limitine ulaşmış.': 'This invite code has reached its usage limit.',
        'Geçersiz davet kodu.': 'Invalid invite code.',
        'Bu davet kodunun süresi dolmuş.': 'This invite code has expired.',
        'Kanal bulunamadı.': 'Channel not found.',
        'Kanal adı gerekli.': 'Channel name is required.',
        'Bu adla bir kanal zaten var.': 'A channel with this name already exists.',
        'Oda bulunamadı.': 'Room not found.',
        'Sesli sohbet henüz yapılandırılmadı.': "Voice chat isn't set up yet.",
        // Mesajlar
        'Mesaj bulunamadı.': 'Message not found.',
        'Mesajlar alınamadı.': 'Could not fetch messages.',
        'Sohbet bulunamadı.': 'Conversation not found.',
        'Boş mesaj gönderilemez.': "You can't send an empty message.",
        'Bu mesaja erişimin yok.': "You don't have access to this message.",
        'Sadece arkadaşlarınla mesajlaşabilirsin.': 'You can only message your friends.',
        'Sadece Lobi mesajları sabitlenebilir.': 'Only lobby messages can be pinned.',
        'Sesli mesaj çok uzun.': 'The voice message is too long.',
        'Mesajın bu lobinin kelime filtresine takıldı ve gönderilmedi.': "Your message was caught by this lobby's word filter and wasn't sent.",
        'Mesajın bu lobinin kelime filtresine takıldı ve kaydedilmedi.': "Your message was caught by this lobby's word filter and wasn't saved.",
        'Yalnızca kendi mesajını düzenleyebilirsin.': 'You can only edit your own messages.',
        'Yalnızca kendi mesajını silebilirsin.': 'You can only delete your own messages.',
        'Bu mesaj türü düzenlenemez.': "This type of message can't be edited.",
        'Mesaj zaten silinmiş.': 'The message was already deleted.',
        'Bu mesajın geçmişi tutulmuyor.': "This message's history isn't kept.",
        'Düzenleme geçmişini yalnızca kurucu ve moderatörler görebilir.': 'Only the owner and moderators can see edit history.',
        // Emoji / çıkartma / bildirim / rapor
        'Emoji adı 2-20 karakter; yalnızca küçük harf, rakam ve alt çizgi.': 'Emoji name: 2–20 characters; lowercase letters, numbers and underscores only.',
        'Kişisel emoji oluşturmak Sauran Plus/Premium aboneliği (ya da hediye) gerektirir.': 'Creating personal emojis requires Sauran Plus/Premium (or a gift).',
        'Kendi çıkartmanı oluşturmak Sauran Plus/Premium aboneliği (ya da hediye) gerektirir.': 'Creating your own stickers requires Sauran Plus/Premium (or a gift).',
        'Bildirim sürümü gerekli.': 'Notice version is required.',
        'Bildirim gönderilemedi.': 'Could not send the notification.',
        'Bildirim bulunamadı.': 'Notification not found.',
        'Rapor bulunamadı.': 'Report not found.'
    };
    const PATTERNS = [
        [/^Çok fazla .*\. (\d+) dakika sonra tekrar dene\.?$/, 'Too many attempts. Try again in $1 minutes.'],
        [/^Çok (fazla|hızlı) .*(tekrar dene|yavaşla)\.?$/, 'Too many requests. Please slow down and try again shortly.'],
        [/^En fazla (\d+) karakter\.$/, 'At most $1 characters.'],
        [/^.+ Seviye (\d)'te açılır\.( Lobiyi takviye et\.)?$/, 'This unlocks at lobby Level $1. Boost the lobby to unlock it.'],
        [/^Mesajın çok uzun \(en fazla (\d+) karakter\)\.$/, 'Your message is too long (max $1 characters).']
    ];
    function lang() {
        try { return localStorage.getItem('sauran_lang') || 'tr'; } catch (_) { return 'tr'; }
    }
    function translateServerError(msg) {
        if (typeof msg !== 'string' || !msg || lang() !== 'en') return msg;
        if (Object.prototype.hasOwnProperty.call(MAP, msg)) return MAP[msg];
        for (const [re, en] of PATTERNS) if (re.test(msg)) return msg.replace(re, en);
        return msg;
    }
    window.translateServerError = translateServerError;

    // Tüm fetch yanıtları: JSON'daki `error` alanı (yalnızca İngilizce arayüzde, yalnızca bilinen metinler) çevrilir.
    if (typeof Response !== 'undefined' && Response.prototype.json && !Response.prototype.json.__sauranErr) {
        const origJson = Response.prototype.json;
        const wrapped = function () {
            return origJson.call(this).then((d) => {
                if (d && typeof d === 'object' && typeof d.error === 'string') {
                    try { d.error = translateServerError(d.error); } catch (_) { /* yoksay */ }
                }
                return d;
            });
        };
        wrapped.__sauranErr = true;
        Response.prototype.json = wrapped;
    }
})();
