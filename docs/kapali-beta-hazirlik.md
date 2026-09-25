# Closed Beta Readiness (kapalı beta hazırlık durumu)

Tarih: 2026-09-25 · Kapsam: mevcut çalışan Sauran'ı 10–20 tanıdık kullanıcıyla kontrollü kullanıma hazırlamak. Genel halka açılış DEĞİLDİR.
Durum etiketleri: **PASS** (yapıldı ve doğrulandı) · **PARTIAL** (kısmen) · **BLOCKED** (dış bağımlılık/credential/cihaz gerekli) · **NOT VERIFIED** (yapılmadı/doğrulanamadı).

## Kontrol listesi
| Madde | Durum | Not |
|---|---|---|
| Android release APK hazır | **PASS** | `1.0.0-beta.1` (versionCode 2), release, imzalı, hata ayıklanamaz |
| APK imzası kontrol edildi | **PASS** | `apksigner verify` (v2); anahtar depo DIŞINDA — **anahtarı yedekleyin** |
| APK üretim backend'ine bağlanıyor | **PARTIAL** | APK içinde `https://sauran.online` doğrulandı; **gerçek cihazda bağlantı denenmedi** |
| APK siteden indirilebilir | **PASS** (kod) · **NOT VERIFIED** (canlı) | `/downloads/…apk` + `beta.json`; **Render'a deploy edilene kadar canlıda yoktur** |
| APK sağlama toplamı (SHA-256) | **PASS** | `beta.json` ve sitede gösterilir |
| Play Store geçiş planı | **PASS** (belge) | `docs/android-yayin-ve-play-store.md`; Play entegrasyonu yapılmadı |
| Kapalı beta davet sistemi | **PASS** | Founder-only, hash'li, süre/iptal/çok kullanımlı, atomik tüketim, hız sınırı (`beta_suite` 44/44) |
| Mevcut kullanıcılar korunuyor | **PASS** | Giriş akışı değişmedi; davet yalnızca yeni kayıtta |
| Beta bilgilendirme metni | **PASS** | Giriş/kayıt ekranında not; **mevcut** ilk-giriş geliştirme bildirimi genişletildi (ikinci modal yok); landing'de rozet/açıklama |
| Beta geri bildirim sistemi | **PASS** | Ayarlar → Beta (10 kategori, hız sınırlı, bağlam yalnızca kısa etiket); founder/admin listesi. Ekran görüntüsü yükleme **eklenmedi** (güvenli altyapı yok) |
| Founder beta yönetimi | **PASS** | `admin.html` → Beta sekmesi (davet oluştur/iptal, mod aç/kapat, geri bildirim) |
| Yedek mekanizması | **PASS** (kod) · **PARTIAL** (üretim) | Günlük otomatik asgari yedek (üretimde `NODE_ENV=production` ile açık) — **canlıda çalıştığı deploy sonrası `/api/admin/health` ile doğrulanmalı** |
| Off-site (uzak) yedek | **BLOCKED** | Adaptör hazır (şifreli, S3 uyumlu); **sağlayıcı ve credential yok**. Eksikler: `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`, `BACKUP_ENCRYPTION_KEY` |
| Restore testi | **PASS** (geçici DB) · **NOT VERIFIED** (üretim) | `ops_suite`: bozulma tespiti, doğrulamalı geri yükleme, üzerine yazma koruması. Üretim DB'sinde denenmedi (bilinçli) |
| Sağlık kontrolü (health) | **PASS** | `/healthz` (herkese açık, yalnızca durum) + `/api/admin/health` (admin+) |
| Hata günlüğü kontrolü | **PARTIAL** | Günlük konsola; harici hata izleme (Sentry vb.) yok |
| Hassas veri günlüğe yazılıyor mu | **PASS** | `ops_suite` kaynak taraması: istek gövdesi/çerez/parola/oturum belirteci/gizli env yazdıran log çağrısı yok |
| Moderasyon kontrolü | **PASS** | `evidence`, `role_notice`, `auditlog`, moderasyon rol testleri geçti |
| Hesap silme kontrolü | **PASS** | `delete_suite`, `dm_deletion`, beta verisi cascade (`beta_suite`) |
| Veri dışa aktarma kontrolü | **PASS** | `kvkk_suite`; `beta_feedback` dışa aktarımda |
| Session/auth kontrolü | **PASS** | `auth16`, `codes`, `cookie`, `auth_cleanup` |
| Voice/Daily kontrolü | **PARTIAL** | Sunucu mantığı testli (`voiceroom` 20/20; kapasite, çoklu cihaz, ayrılma). Gerçek Daily'yi sahibi arkadaşıyla denedi; **ben gerçek Daily'de doğrulayamadım** |
| Android testleri | **NOT VERIFIED** | Gerçek Android cihaz testi yapılmadı |
| iPhone testleri | **PARTIAL** | Sahibi Safari/PWA'da bildirim ve klavye düzeltmelerini denedi (bildirim çalışıyor); ben cihaz erişimi olmadan test etmedim |
| Web testleri | **PARTIAL** | Tarayıcıda (Chromium emülasyonu) akışlar denendi; çoklu tarayıcı matrisi yok |
| Legal review checklist | **PASS** (belge) | `docs/hukuki-inceleme-kontrol-listesi.md` — **hukuki inceleme YAPILMADI** |
| Beta kullanıcı iletişim metni | **PASS** | Aşağıda |

## Beta başlatma adımları (sıra)
1. **Deploy öncesi** Render → Disk → Snapshots'tan elle snapshot alın (ilk açılış temizlikleri geri alınamaz).
2. Render'a son commit'i deploy edin (Manual Deploy). Loglarda "Otomatik yedek…" (2 dk sonra) ve `/healthz` kontrol edin.
3. Founder hesabıyla `admin.html → Beta` → davet oluşturun (etiket, kullanım, gün). Kodu davetlilere **özel kanalla** iletin (kod bir daha gösterilmez).
4. APK'yı `sauran.online` ana sayfasından indirtin (SHA-256 sitede).
5. Geri bildirimleri `admin.html → Beta → Geri bildirimler`'de izleyin.
6. Acil durumda: panelden "Kayıt için davet kodu iste"yi kapatın (ya da `BETA_INVITE_REQUIRED=off`).

## Kullanıcı iletişim taslağı
> **Sauran kapalı beta'sına davetlisin!** Sauran; sesli odalar, özel mesajlar ve topluluklar için geliştirdiğimiz bir sohbet uygulaması. Şu anda kapalı beta aşamasında: bazı özellikler değişebilir, hatalarla ya da kısa süreli kesintilerle karşılaşabilirsin. Kayıt için davet kodun: `XXXXX-XXXXX` — `sauran.online` üzerinden kayıt ol, ya da Android için sitedeki "Android APK'yı İndir" bağlantısını kullan (yalnızca sauran.online'dan indir). Bir sorunla karşılaşırsan uygulamada **Ayarlar → Beta** bölümünden bize yaz; şifreni ya da başkalarının özel bilgisini yazma. Teşekkürler!

## Kapsam sınırı
Gelişmiş arama, bot/entegrasyon, tam Discord benzeri roller, SFU, kamera/video, monetizasyon, keşif vb. **bilinçli olarak kapsam dışıdır**.

## Kullanıcı sayısı
Sistem 20 kişiyle sınırlanmadı: davet sayısı/kullanım limiti founder tarafından serbestçe belirlenir (kod başına 1–1000 kullanım). Tek örnek + bellek içi hız sınırı ile ~onlarca eşzamanlı kullanıcı hedeflenir; yüzlerce kullanıcıda kapasite gözden geçirilmelidir.
