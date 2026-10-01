# Sauran iPhone uygulaması — yayın rehberi

Uygulama hazır: `mobile/ios/` içinde. Mac gerekmez; derleme GitHub'ın macOS makinelerinde yapılır (`.github/workflows/ios.yml`).
Bu rehber, **Apple geliştirici hesabı açıldıktan sonra** yapılacakları sırasıyla anlatır.

## Uygulamada neler var

| Özellik | Nasıl |
|---|---|
| Sauran'ın kendisi | `https://sauran.online` yerel WebView'da açılır (Android ile aynı). Web'e gelen her güncelleme uygulamaya da anında gelir; yeniden yayın gerekmez. |
| Sesli oda arka planda | Ekran kilitlenince / başka uygulamaya geçince ses sürer (`UIBackgroundModes: audio`, `SauranVoice` eklentisi). Kilit ekranında "Sesli görüşme" ve oynat/duraklat ile mikrofonu aç/kapat. |
| Ses çıkışı seçimi | Hoparlör, ahize, kablolu kulaklık, Bluetooth (web'deki ses çıkışı menüsü). |
| Bildirimler | Uygulama arka plandayken yerel bildirim (`SauranNotify`); tamamen kapalıyken sunucudan APNs. Bildirimlerde mesaj içeriği ya da isim **yoktur** (Android'deki kuralla aynı). |
| Bağlantılar | `sauran.online` bağlantıları uygulamada açılır (Universal Links). |
| İzin metinleri | Mikrofon, kamera, fotoğraflar — Türkçe. |
| Simge / açılış ekranı | Sauran logosu, koyu arka plan. |

## 1. Apple geliştirici hesabı (bir kez)

1. <https://developer.apple.com/programs/enroll/> → Apple kimliğinle kaydol (bireysel; yıllık 99 $). Onay genelde 1–2 gün.
2. **Membership** sayfasından **Team ID**'yi not al (10 karakter, ör. `AB12CD34EF`).

## 2. Uygulama kimliği ve App Store kaydı

1. developer.apple.com → **Certificates, Identifiers & Profiles → Identifiers → +** → App IDs → App
   - Bundle ID: `online.sauran.app` (Explicit)
   - Capabilities: **Push Notifications** ve **Associated Domains** işaretli
2. <https://appstoreconnect.apple.com> → **Uygulamalar → + → Yeni Uygulama**
   - Platform iOS · Ad: **Sauran** · Birincil dil: Türkçe · Bundle ID: `online.sauran.app` · SKU: `sauran-ios`

## 3. Derleme için API anahtarı (GitHub'a)

1. App Store Connect → **Kullanıcılar ve Erişim → Entegrasyonlar → App Store Connect API → +**
   - Ad: `GitHub`, Erişim: **Admin** → oluştur → **.p8 dosyasını indir** (bir kez indirilebilir!)
   - Sayfadaki **Issuer ID** ve anahtarın **Key ID**'sini not al.
2. GitHub → schizoro/Sauran → **Settings → Secrets and variables → Actions → New repository secret**:

| Ad | Değer |
|---|---|
| `APPLE_TEAM_ID` | Team ID |
| `ASC_KEY_ID` | Key ID |
| `ASC_ISSUER_ID` | Issuer ID |
| `ASC_KEY_P8_BASE64` | .p8 dosyasının base64 hali (Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("AuthKey_XXXX.p8"))`) |

## 4. Bildirim anahtarı (Render'a)

1. developer.apple.com → **Keys → +** → **Apple Push Notifications service (APNs)** → indir (`AuthKey_YYYY.p8`).
2. Render → Sauran → **Environment**:

| Ad | Değer |
|---|---|
| `APNS_KEY_P8` | .p8 dosyasının içeriği (tamamı) ya da base64 hali |
| `APNS_KEY_ID` | bu anahtarın Key ID'si |
| `APNS_TEAM_ID` | Team ID |
| `APNS_ENV` | `production` |
| `APPLE_TEAM_ID` | Team ID (Universal Links için `/.well-known/apple-app-site-association`) |

## 5. Derle ve TestFlight'a yükle

GitHub → **Actions → iOS → Run workflow** → **release** kutusunu işaretle → Run.
~15 dk sonra derleme App Store Connect → **TestFlight**'ta görünür (Apple'ın işlemesi 10–30 dk).
TestFlight'tan kendine ve arkadaşlarına (e-postayla, 100 kişiye kadar dış test) dağıtabilirsin.

## 6. App Store'a gönder

App Store Connect → Sauran → **1.0 Hazırlanıyor**:

- **Ekran görüntüleri:** 6.9" iPhone (1320×2868 ya da 1290×2796) en az 3 adet. Telefonundan ekran görüntüsü alman yeterli.
- **Açıklama (öneri):**
  > Sauran; arkadaşlarınla ve topluluklarınla sesli odalarda konuşabileceğin, mesajlaşabileceğin ve ekran paylaşabileceğin bir sohbet uygulaması. Lobiler kur, sesli odalarda takıl, grup sohbetleri aç, dosya ve sesli mesaj gönder.
- **Anahtar kelimeler:** `sohbet,sesli sohbet,arkadaş,oyun,topluluk,lobi,mesaj,ekran paylaşımı`
- **Destek URL'si:** `https://sauran.online/destek.html` · **Gizlilik politikası:** `https://sauran.online/gizlilik-politikasi.html`
- **Yaş derecelendirmesi:** kullanıcılar arası sohbet içerdiği için anketi dürüst doldur (genelde 12+ / 17+ çıkar).
- **Uygulama Gizliliği (veri toplama):** E-posta adresi, kullanıcı adı, kullanıcı içeriği (mesajlar, ses, fotoğraf), cihaz kimliği (bildirim anahtarı) — hepsi "uygulama işlevi" amaçlı, **izleme (tracking) yok**, üçüncü tarafla reklam paylaşımı yok.
- **İnceleme notları (App Review):** Apple'a çalışan bir **demo hesabı** ver (kullanıcı adı + şifre; 2FA kapalı) ve şunu yaz:
  > Sauran is a voice and text chat app. Users can report messages/users/lobbies (long-press a message → Report), block users (profile → Block), and delete their account in Settings → Account → Delete account. Moderators and an admin team review reports. Voice rooms use the microphone; background audio keeps voice chat running while the screen is locked.

## Apple incelemesinde bilinmesi gerekenler

- **4.2 Asgari işlevsellik:** "web sitesini saran uygulama" reddi riski vardır. Sauran'da yerel arka plan sesi, kilit ekranı kontrolleri, yerel ses çıkışı seçimi ve push bildirimleri bulunduğu için güçlü durumdayız; reddedilirse bu özellikleri notlarda vurgula.
- **1.2 Kullanıcı üretimli içerik:** bildirme, engelleme, içerik filtresi ve moderasyon zorunlu — Sauran'da hepsi var.
- **5.1.1(v) Hesap silme:** uygulama içinden hesap silme zorunlu — Ayarlar → Hesap'ta var.
- **Ödeme:** Uygulama içinde dijital ürün (Sauran Plus vb.) satılacaksa Apple'ın uygulama içi satın alma sistemi zorunludur; ödeme sistemi açılmadan önce bu ayrıca ele alınmalı.

## Sürüm güncelleme

Web tarafındaki değişiklikler uygulamaya kendiliğinden gelir. Yalnızca `mobile/ios/` (yerel kod, izinler, simge) değişince yeni derleme gerekir:
`App.xcodeproj` içindeki `MARKETING_VERSION`'ı (1.0 → 1.1) artır, sonra 5. adımı tekrarla (derleme numarası otomatik artar).
