# Sauran — Yapılacak Özellikler (Yol Haritası)

Sıra, kullanıcı deneyimine etkisi ve yapım kolaylığına göre belirlendi. Her madde tamamlandıkça işaretlenir; adım adım ilerlenir.

Durum: `[ ]` sırada · `[~]` yapılıyor · `[x]` tamamlandı

## 1. Sohbetin temel eksikleri
- [x] **Eski mesajları yükleme** — Lobi sohbeti ve DM'de yukarı kaydırınca 50'şer mesajlık eski sayfalar gelir; mesaj tablosuna dizin eklendi.
- [x] **Kalıcı okunmamış göstergesi** — DM ve lobi okunmamış sayıları sunucuda tutulur; yenileme ve cihazlar arası doğru, bir cihazda okununca diğerinde de sıfırlanır.
- [x] **@bahsetme** — `@` ile üye önerisi, vurgulama, bahsedilene bildirim (lobi sessizde olsa da), lobi listesinde "@" rozeti. `@everyone`'ı kimin kullanabileceğini Lobi kurucusu ayarlardan seçer.
- [x] **"Yazıyor…" göstergesi** — Lobi ve DM'de; 1 kişi / 2 kişi / "Birkaç kişi yazıyor…". Sinyal kesilince 5 sn'de, mesaj gönderilince ya da alan silinince hemen kalkar.
- [x] **Mesaj arama** — Lobi ve DM'de 🔍 paneli; Türkçe harf/aksan duyarsız ("isik" → "IŞIK"), önek ve çoklu kelime, `kimden:ad` süzgeci, sonuçta vurgulama. Sonuca dokununca o mesaja gidilir (çevresi yüklenir, "En yeni mesajlara dön").
- [ ] **Lobide çoklu metin kanalı** (#genel, #oyun …) *(ertelendi — sonra ele alınacak)*

## 2. Hesap güvenliği
- [x] **İki adımlı doğrulama (2FA)** — Ayarlar → Güvenlik'ten açılır; QR ile doğrulayıcı uygulama (Google/Microsoft Authenticator, 1Password…), 10 tek kullanımlık kurtarma kodu, girişte ikinci adım. Gizli anahtarlar şifreli saklanır; aynı kod iki kez kullanılamaz.
- [x] **E-posta adresini değiştirme** — Ayarlar → Güvenlik; şifre (2FA açıksa ayrıca kod) ister, yeni adrese 6 haneli kod gider, kod girilince değişir ve eski adrese bilgi e-postası gider. Adres ayarlarda maskeli görünür.

## 3. Moderasyon
- [ ] Yavaş mod (mesajlar arası zorunlu bekleme) ← sıradaki
- [ ] Kelime filtresi / otomatik moderasyon
- [ ] Lobi içi moderasyon kaydı (kim kimi attı/banladı/susturdu)
- [ ] Davet kodlarına süre ve kullanım sınırı

## 4. Ses ve medya
- [ ] Bas-konuş (push-to-talk)
- [ ] GIF arama
- [ ] Link önizlemesi
- [ ] Kamera / görüntülü görüşme *(şu an bilinçli olarak yok; karar gerekli)*

## 5. Platform ve ticari
- [ ] Grup DM
- [ ] iOS yerel uygulama *(şu an PWA)*
- [ ] Ödeme sistemi *(bilinçli olarak kapalı beta + hukuki inceleme sonrasına bırakıldı; bkz. `ucretlendirme-hazirlik.md`)*

## Tamamlananlar (Ekim 2026)
- [x] Mesaj iletimi: anında görünen "gönderiliyor" mesajı, iPhone'da klavye/ekran zıplaması, doğrudan WebSocket, mesaj saatlerinin 3 saat geri görünmesi, Ayarlar'da bağlantı gecikmesi ölçer
- [ ] *Karar bekliyor:* sunucu bölgesinin (Render) Frankfurt'a taşınması
- [x] Lobi ayarları tam ekran ve bölümlü yeni tasarım (Genel, Görünürlük ve Katılım, Bahsetmeler, Davet, Moderasyon, Diğer)
- [x] iPhone'da ekran paylaşımı tam ekran düzeltmesi
- [x] Güvenlik denetimi ve düzeltmeleri (XSS, IDOR, güvenlik başlıkları, gövde sınırı, hız sınırları, Daily token)
- [x] Sesli odada kalıcı, süreli susturma (30 / 60 dk / kaldırılana kadar) + Susturulanlar listesi
- [x] Ekran sesinin yalnızca "İzle" diyene çalınması
- [x] Sesli odadan atma (anlık / 30 / 60 dk / kaldırılana kadar) + Odaya Girişi Engellenenler listesi
