# Üçüncü taraf servisler ve veri aktarımı (Aşama 17)

> **Uyarı:** Bu belge **koddan çıkarılabilen** gerçek veri akışlarını anlatır. Sağlayıcıların veri merkezi konumu, saklama süresi, alt işleyenleri ve KVKK kapsamındaki
> yurt dışı aktarım dayanağı **koddan bilinemez**; aşağıda "**doğrulanmalı**" olarak işaretlidir. Bu belge hukuki uygunluk garantisi vermez.

Kodda (istemci HTML/JS, sunucu, mobil kabuk) gerçekten kullanılan dış bağlantılar taranmıştır: **analitik, reklam, harici yazı tipi, izleme pikseli veya sosyal eklenti YOKTUR**.
Aşağıdaki servisler dışında üçüncü tarafa istek yapan kod bulunmaz.

## Özet tablo

| Servis | Ne zaman | Giden veri | Kullanıcıya ait mi | Yük minimizasyonu | Uygulama tarafı saklama | Sağlayıcı tarafı saklama / konum |
|---|---|---|---|---|---|---|
| **Firebase Cloud Messaging (Google)** | Kullanıcı çevrimdışı/görünmezken DM, lobi mesajı, arama, arkadaşlık isteği/kabulü, lobi daveti, yönetim görevi bildirimi | Cihaz kayıt anahtarı (FCM token), sabit başlık `Sauran`, türe göre sabit genel metin, `data.type`, Android `tag = type` | Token cihaza/kullanıcıya bağlıdır; içerik kullanıcıya özgü değildir | **Uygulandı (Aşama 9):** mesaj içeriği, gönderen adı, lobi adı, kullanıcı/sohbet/lobi numarası, URL YOK. Çağıran title/body/url/tag verse bile taşıma katmanı yok sayar | `fcm_tokens` (token, UA, tarih): hesap silinince cascade ile silinir; geçersiz token (404/geçersiz) anında silinir | **Doğrulanmalı** (Google; konum ve saklama koddan bilinmez) |
| **Web Push (tarayıcı üreticisinin push hizmeti)** | Aynı olaylar, tarayıcı/PWA aboneliği varsa | Abonelik uç noktası (push hizmetine gider), Web Push standardıyla **şifrelenmiş** yük: başlık `Sauran`, sabit genel metin, `type`, `tag = type`; TTL 1 saat, öncelik yüksek | Uç nokta cihaza/kullanıcıya bağlıdır; yük değildir | **Uygulandı (Aşama 10):** FCM ile aynı genel yük; `sw.js` de yükten bağımsız sabit metin kullanır | `push_subscriptions` (uç nokta, anahtarlar, UA): hesap silinince cascade; 404/410'da silinir | **Doğrulanmalı** (Google/Mozilla/Apple/Microsoft; teslim edilmemiş mesaj push hizmetinde en fazla TTL kadar bekleyebilir) |
| **Daily.co (sesli/görüntülü)** | Sesli sohbete, sesli odaya veya DM aramasına katılınca | Oda adı (`sauran-hub-<id>`, `sauran-vr-<id>`, `sauran-dm-<küçük id>-<büyük id>`), katılım belirteci: `user_name`, lobi sesli odasında `user_id`, süre 4 saat; canlı ses/ekran paylaşımı (WebRTC) | Evet (kullanıcı adı, hesap numarası, oda adındaki numaralar, canlı ses) | **Uygulandı (bu aşama):** birebir DM aramasında kullanıcı adı **gönderilmez** (sabit `Sauran`). Lobi odalarında `user_name` arayüz işlevi için (konuşan/ekran paylaşan gösterimi) gereklidir, korunmuştur | Odalar uygulamanın **silme kuyruğuyla** (`daily_room_cleanup`) silinir: lobi silinince, sesli oda silinince, hesap silinince (DM çağrı odaları). Aktif DM çifti hesap silinmedikçe DM çağrı odası Daily'de kalabilir | **Doğrulanmalı** (Daily; konum, medya/kayıt saklama, alt işleyenler). Uygulama ses **kaydetmez** |
| **Zoho Mail (SMTP)** | Kayıt doğrulama kodu, şifre sıfırlama kodu, yönetim görevi bildirimleri (kullanıcıya), yeni rapor bildirimi ve görev kabul/ret bildirimi (moderasyon ekibine), kayıtlı e-postayla kayıt denemesinde bilgi e-postası | Alıcı e-posta adresi, e-posta metni. Rapor bildirimi yalnızca rapor no/kategori/öncelik/panel bağlantısı; görev kabul/ret ekibe kullanıcı adı ve hesap no (**konu satırında kullanıcı adı yok**, bu aşamada kaldırıldı). Doğrulama/sıfırlama e-postaları 6 haneli kod içerir | Evet (e-posta adresi, kod) | Rapor e-postası minimum alanlı (Aşama 6). Kod uygulamada yalnızca hash olarak tutulur; e-postada düz gider (zorunlu). Bilgi e-postası kod içermez | Uygulama outbox'ında içerik saklanmaz (Aşama 8); kod/kayıt süreli (10 dk) | E-posta gövdeleri gönderici (`destek@sauran.online`) posta kutusunda ve alıcı sağlayıcısında kalır: **uygulama dışı, saklama doğrulanmalı** (Zoho konumu/saklama koddan bilinmez) |
| **Render (barındırma)** | Sürekli: tüm istekler, veritabanı dosyası, günlükler | Bütün uygulama verileri (sunucu diski), HTTP istekleri (IP, UA, yol), sunucu günlükleri | Evet | Sunucu günlüklerine **kullanıcı adı/e-posta/IP yazılmaz** (soket günlüklerinden kullanıcı adı bu aşamada kaldırıldı; e-posta hata günlüğü yalnızca hata kodu yazar) | Canlı DB: uygulama cleanup'ları. Disk yedeği/anlık görüntü: bkz. Aşama 18 belgesi | **Doğrulanmalı** (bölge, disk snapshot/yedek süresi, istek günlüğü saklama; koddan bilinmez) |
| **unpkg.com (CDN)** | — (**artık kullanılmıyor**) | — | — | **Kaldırıldı (bu aşama):** `daily-js@0.92.2` (BSD-2-Clause) `client/vendor/` altından kendi origin'imizden sunulur, SRI korunur. Sayfa açılırken üçüncü taraf CDN'e IP/UA gitmez | — | — |
| **Google Play Hizmetleri / Android WebView** (mobil kabuk) | Android uygulamasında bildirim kaydı | FCM token üretimi Google altyapısıyla yapılır; uygulama `https://sauran.onrender.com` adresini WebView'da açar | Evet (token) | — | Token için yukarıya bkz. | **Doğrulanmalı** (Google) |

## Ayrıntılar ve güvenlik

* **İletişim güvenliği:** Tüm dış çağrılar HTTPS/TLS (`api.daily.co`, FCM/Web Push, Zoho `smtp.zoho.com:465` SSL). Çerez `Secure` (Aşama 14).
* **Gizli anahtarlar:** `DAILY_API_KEY`, `FIREBASE_SERVICE_ACCOUNT_*`, `VAPID_*`, `ZOHO_EMAIL_PASSWORD` yalnızca ortam değişkenidir; depoya konmaz, istemciye gönderilmez.
* **Daily belirteci:** 4 saat geçerli, oda kapsamlı; oda `private`, kamera kapalı başlar, sohbet kapalı (`enable_chat:false`), DM odasında ekran paylaşımı kapalı.
* **Daily oda adları** sayısal kimlikler taşır (lobi/sesli oda/kullanıcı çifti). Bunlar uygulama içindeki kimliklerdir; ad değildir, ama kullanıcıya bağlanabilir.
* **Web Push vs FCM:** Aynı olay ikisine de gidebilir; her ikisinin yükü aynı genel içeriktir (`server/push.js` ve `server/fcm.js` aynı `buildGenericContent`).
* **E-posta numaralandırma:** Kayıtlı e-postayla kayıt denemesinde kod içermeyen bilgi e-postası gider (Aşama 16).

## Yurt dışı aktarım

Google (FCM/Web Push), Daily.co, Zoho ve Render altyapılarının **yurt dışında** olma ihtimali vardır. Verilerin fiilen hangi ülkelerde işlendiği, sağlayıcı sözleşmeleri, alt işleyenler ve
KVKK'daki aktarım dayanağı/güvenceleri **koddan doğrulanamaz**; **hukuki doğrulama gereklidir**. Bu belge servisleri "hukuki doğrulama eksik" diye kaldırmaz; teknik olarak
mümkün olan en az veriyi göndermeyi hedefler.

## Bu aşamada yapılan teknik minimizasyonlar

1. `unpkg.com` bağımlılığı kaldırıldı (kütüphane self-host, `client/vendor/`, lisans notu `DAILY-JS-LICENSE.txt`).
2. DM aramasında Daily'ye kullanıcı adı gönderilmez.
3. Sunucu günlüklerinden kullanıcı adı çıkarıldı (soket bağlan/ayrıl); kayıt/sıfırlama e-posta hata günlüğü yalnızca hata kodu içerir.
4. Yönetim görevi kabul/ret e-postasının konu satırından kullanıcı adı çıkarıldı.
5. Gizlilik politikası (TR/EN) bu gerçeklerle güncellendi.

## Bilinçli olarak değiştirilmeyenler

* Lobi sesli odalarında `user_name`/`user_id`: istemci konuşan/ekran paylaşan kullanıcıyı Daily'nin katılımcı bilgisinden eşleştirir; kaldırmak çalışan ses sistemini bozar.
* FCM/Web Push, Daily ve SMTP entegrasyonları hukuki doğrulama eksik diye kapatılmadı.
