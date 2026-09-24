# Üretime geçmeden önce: yapılandırma, ilk açılıştaki geri alınamaz temizlikler, hız sınırları

> Bu belge bir **operasyonel kontrol listesidir**; hukuki uygunluk beyanı değildir. Sır değerleri (anahtarlar, parolalar) hiçbir test çıktısına, günlüğe veya bu belgeye yazılmaz.
> **Otomatik kontrol:** `node server/preflight.js` (yalnızca "ayarlı/eksik" yazar). **Etki tahmini:** `node server/preflight.js --impact <db-kopyası>` (salt okunur, yalnızca sayılar).

## 1. Ortam yapılandırması

| Değişken | Gerekli mi | Kontrol |
|---|---|---|
| `NODE_ENV=production` | **Evet** | Yoksa CORS ve sıkı ayarlar gevşer. Çerez `Secure` yine de `RENDER=true` ile zorlanır ama `NODE_ENV` ayarlanmalı. |
| `DATA_DIR` (Render **kalıcı disk** yolu) | **Evet** | Ayarsızsa veritabanı depo dizininde kalır ve her dağıtımda silinir. Yazılabilir olmalı; **`client/` içinde olamaz** (sunucu başlamaz). |
| `DAILY_API_KEY` | Sesli sohbet için | Yoksa ses ve Daily temizliği çalışmaz. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push için | `VAPID_SUBJECT` `mailto:` veya `https:` ile başlamalı. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` / `_BASE64` | Android bildirimi için | Bozuksa FCM kapanır. Dosya depoya konmaz. |
| `ZOHO_EMAIL_PASSWORD` | **Evet** | Yoksa doğrulama/sıfırlama e-postaları **gönderilemez** (kayıt tamamlanamaz). |
| `REPORT_EMAIL_TO`, `PUBLIC_BASE_URL` | Önerilir | E-posta alıcısı ve panel bağlantısı. |
| `ALLOWED_ORIGINS` | Genellikle **gerekmez** | Boşsa üretimde yalnızca **aynı-origin** (Host eşleşmesi) kabul edilir. Ek alan adı gerekiyorsa virgülle listelenir. |
| Oturum gizli anahtarı | **Yok/gerekmez** | Belirteçler 256 bit rastgeledir; sunucuda yalnızca SHA-256 özeti tutulur. |
| `trust proxy` | Sabit `1` | Render tek ters proxy; HTTPS `X-Forwarded-Proto` ile algılanır. **Servis doğrudan (proxy'siz) yayınlanmamalı.** |
| HTTPS / çerez | Render TLS | Üretimde çerez her zaman `Secure`; HTTP'ye düşürülemez. |
| `INACTIVE_ACCOUNT_DELETION=off` | İsteğe bağlı | Hareketsiz hesap uyarı/silme turunu kapatır (varsayılan açık; ilk silme dağıtımdan ≥ 730 gün sonra). |

**CORS (bu çalışmada sıkılaştırıldı):** Üretimde `ALLOWED_ORIGINS` boşken artık *her origin* değil, yalnızca aynı origin'e izin verilir; soket el sıkışması da yabancı origin'den reddedilir. Yerel geliştirme etkilenmez.

## 2. İlk açılışta çalışan GERİ ALINAMAZ temizlikler

Aşağıdakiler yeni sürüm **ilk kez** üretim verisiyle açıldığında (ve bir kısmı sonrasında düzenli olarak) çalışır. **Etkiyi önceden görmek için** üretim yedeğinin **kopyasında** `node server/preflight.js --impact <kopya.db>` çalıştırın. "Yedek?" sütunu **önerilen** işletim adımıdır (uygulama otomatik yedek almaz).

| # | Mekanizma | Ne silinir / değişir | Etkilenebilecek veri | Yedek? |
|---|---|---|---|---|
| 1 | **Doğum tarihi geçişi** (yükleme sırasında) | `birth_date`: 18+ için hiçbir tarih kalmaz; 18 altı için yalnızca `minor_until`; bekleyen kayıtlardaki tarih | Tüm kullanıcılar (`birth_date` dolu olanlar) | **Evet** (tarih geri gelmez) |
| 2 | **Silinmiş mesaj kalıntısı** + **kopuk bağlantı süpürmesi** | Eski silinmiş mesajlarda kullanıcı bağı/adı/tepki/oy/sabit; kaynağı olmayan forward kopyaları **içeriksiz** olur; kopuk reply/pin; eski `general` odası satırları silinir | Eski silinmiş/iletilmiş mesajlar | **Evet** |
| 3 | **Mesaj saklama** (açılış + saatlik) | 90 günden eski **medya** (base64 silinir); sohbetin en yeni 200'ü dışında kalan 365 günden eski **metin** (sabitler hariç); 730 gündür hareketsiz sohbetlerin **tüm mesajları** | **En büyük etki**: eski mesajların tamamı olabilir | **Evet (kesin)** |
| 4 | **Rapor/kanıt saklama** (açılış + günlük) | `retention_until`'i geçmiş kanıt metni/medyası/rapor kaydı | Eski moderasyon kayıtları | **Evet** |
| 5 | **Bildirim / e-posta kuyruğu** (saatlik) | Süresi dolan bildirimler, kuyruk kayıtları | Kısa ömürlü veri | Gerekmez |
| 6 | **Denetim kaydı** (günlük) | 90 günden eski gerekçe, 365 günden eski kayıt | Yönetici işlem geçmişi | **Evet** |
| 7 | **Silinmiş hesap DM sohbetleri** (saatlik) | Hesap silme anından 90 gün geçenler | Karşı tarafın korunan mesajları | **Evet** |
| 8 | **Görsel üstverisi** (açılış) | Profil/kapak/lobi görsellerinden EXIF/GPS/XMP çıkarılır | Görsel sayısı kadar satır (görüntü aynı) | Gerekmez |
| 9 | **Kimlik/kod temizliği** (10 dk) | Süresi dolan oturum/kod | Geçici veri | Gerekmez |
| 10 | **Yedek/geçici dosya temizliği** (günlük) | `DATA_DIR`'de **7 günden eski** `backups/`, `sauran.db.bak*`, `sauran.db.pre-*`, `sauran-premigration*`, `sauran-export*`, `sauran-dump*` dosyaları | **Operatörün kendi yedeği de silinir** | Yedeği başka yere alın |
| 11 | **Hareketsizlik/davet/istek/öneri sayaçları** | İlk açılışta yalnızca **sayaç başlar** (silme yok); silme ≥ 30 gün (davet 7 gün) sonrasında | Yok (ilk açılışta) | Gerekmez |
| 12 | **`data_lifecycle_log`** tablosu ve yeni sütunlar | Yeni tablo/sütun eklenir (veri silinmez) | — | Gerekmez |

**Önerilen sıra:** (1) `node server/backup.js` ile asgari yedek (7 gün sonra otomatik silinir) → (2) yedeğin kopyasında `--impact` → (3) etki kabul edilebilirse dağıtım → (4) doğrulama bitince yedeği silme kararı (bkz. `yedekleme-ve-dis-kopyalar.md`).
3 numaralı temizlik çok sayıda satır silerse ilk açılış uzayabilir (turlar sınırlıdır; tekrar çalıştırmak zararsızdır).

## 3. Hız sınırları ve tek örnek varsayımı

Hız sınırları **süreç belleğindedir** (`server/index.js`). Yeniden başlatma (Render restart/dağıtım) sayaçları sıfırlar; **çok örnekli** (birden fazla instance) çalıştırılırsa sınırlar örnekler arasında **paylaşılmaz** (etkin sınır örnek sayısıyla çarpılır).
**Sauran tek örnek (tek web servisi) varsayımıyla çalışacak şekilde tasarlanmıştır**; Render'da ölçeklendirme/otomatik ölçekleme açılırsa bu belge yeniden değerlendirilmelidir. Redis gibi ek altyapı **şu an gerekli değildir**, çünkü kritik korumalar zaten kalıcıdır:

| Uç / koruma | Sınır | Kalıcı mı |
|---|---|---|
| Doğrulama/şifre sıfırlama kodu | Kayıt başına **5 deneme** (DB), 10 dk ömür, IP + kullanıcı başına ek sınır | **Evet (DB)** |
| Giriş | IP+kullanıcı başına 8 / 5 dk | Bellek |
| Kayıt | IP başına 5 / 15 dk | Bellek |
| Şifre sıfırlama isteği | IP başına 5 / 15 dk | Bellek |
| Şifre değiştirme, hesap silme | IP başına 10 / 15 dk, 5 / 15 dk (hesap silme ayrıca parola ister) | Bellek |
| Davet kodu ile katılım (yeni) | IP başına 20 / 10 dk (kod 40 bit rastgele) | Bellek |
| Kullanıcı adı arama (yeni) | IP başına 60 / 10 dk | Bellek |
| Profil görüntüleme (yeni; artık **giriş şartlı**) | IP başına 120 / dk | Bellek |
| Arkadaşlık isteği / lobi oluşturma / davet / rapor / öneri / dosya | Mevcut saatlik/10 dk sınırları | Bellek |
| Mesaj gönderme (soket) | Soket başına 15 / 10 sn | Bellek (soket ömrü) |

**Bilinen sınır:** Çok sayıda farklı IP'den dağıtık deneme veya çok sayıda soketle mesaj gönderme bellek içi sınırlarla tam engellenemez; hesap başına kilitleme, meşru kullanıcıyı kilitleme (DoS) riski nedeniyle bilinçli olarak eklenmemiştir.

## 4. Gerçek cihaz testleri
Bu ortamda gerçek işletim sistemi bildirim tıklaması, iPhone/iPad PWA ve gerçek FCM/Web Push teslimatı **test edilemez**; yalnızca servis işçisi mantığı Worker'da ve sayfa akışları gerçek tarayıcıda doğrulanmıştır. Cihaz üstünde yapılacak testler: `docs/gercek-cihaz-test-plani.md`.

## 5. Yayın öncesi zorunlu operasyonel maddeler (özet)
`NODE_ENV=production` · kalıcı disk `DATA_DIR` · SMTP/Daily/VAPID/Firebase anahtarları · `preflight` çıktısında **HATA yok** · yedek + `--impact` etkisi onayı · gerçek cihaz testi · sağlayıcı (Render/Zoho/Daily/Firebase) doğrulamaları (`ucuncu-taraf-veri-aktarimi.md`) · hukuki inceleme (`veri-saklama-hukuki-eslestirme.md`).
