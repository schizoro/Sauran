# Yedek, anlık görüntü ve dış kopyaların yaşam döngüsü (güncel)

> **Uyarı:** Bu belge yalnızca **uygulama kodundan** ve **Render'ın herkese açık dokümantasyonundan** (Eylül 2026'da okunan sayfalar) doğrulanabilen durumu anlatır. Doğrulanamayanlar **"Render'dan teyit edilmeli"** olarak bırakılmıştır.
> Hukuki uygunluk garantisi vermez. Süreler "teknik varsayılan"dır. **Bu çalışmada gerçek üretim yedekleri silinmemiş, üretim veritabanına dokunulmamıştır.**

## 1. Kopya envanteri

| Kopya | Var mı | Yaşam döngüsü / kontrol |
|---|---|---|
| Canlı DB `sauran.db` (+ `-wal`, `-shm`) | Evet (`DATA_DIR`, Render kalıcı diski) | Uygulama cleanup'ları. **Silinen içerik dosyada sıfırlanır** (`secure_delete = ON`, bağlantı düzeyinde); WAL saatte bir ve kapanışta kesilir. `DATA_DIR` **herkese açık `client/` dizininin içinde olamaz**: öyleyse sunucu başlamaz (kritik hata). Sunucu yalnızca `client/` dizinini servis eder. |
| Uygulamanın kendiliğinden aldığı yedek | **Hayır** (otomatik yedek kişisel veri kopyası sayısını artırırdı) | — |
| Elle alınan yedek (`node server/backup.js`) | Yalnızca operatör çalıştırırsa | `DATA_DIR/backups/`, izin 0600/0700, dosya adı yalnızca zaman damgası + tür. **Asgari** yedekte oturum, bekleyen kayıt, sıfırlama kodu, push/FCM anahtarları, **bildirimler ve e-posta kuyruğu BOŞ**. **7 gün** sonra sunucu tarafından otomatik silinir (`BACKUP_RETENTION_DAYS` ile değiştirilebilir, `BACKUP_CLEANUP=off` ile kapatılabilir). `--list` (kalan süre), `--purge` (elle temizlik), `--full` (yalnızca gerekirse). |
| Migration öncesi yedek | Operatör isteğine bağlı | Yukarıdaki araçla alınır; **kalıcı arşiv değildir**: doğrulama biter bitmez elle silinmeli, unutulursa 7 gün sonra otomatik silinir. `DATA_DIR` kökündeki `sauran.db.bak*`, `sauran.db.pre-*`, `sauran-premigration*`, `sauran-export*`, `sauran-dump*` gibi **açıkça geçici adlı** eski dosyalar da 7 gün sonra silinir. |
| Dışa aktarım dosyaları | Sunucuda dosya **yazılmaz**; bellekte üretilir, `Cache-Control: no-store` ile indirilir | Kullanıcının kendi cihazındaki kopya kullanıcının sorumluluğundadır. |
| Sunucu günlükleri | Yalnızca konsol; kullanıcı adı/e-posta/IP yazılmaz | Render günlük saklaması: **Render'dan teyit edilmeli**. |
| Geliştirici/test DB kopyaları | `data/sauran.db` yerel dev DB (git dışı); test harness'ı geçici klasöre kopyalar | `.gitignore`: `*.db`, `*.db-wal`, `*.db-shm`, `data/backups/`, `sauran-backup-*`, `sauran-export-*`, `sauran-dump-*`, `.env`. Depoda `.db`/`.env`/yerel migration aracı **takip edilmez** (testle doğrulanır). Üretim verisi geliştirme ortamına **alınmamalı**; zorunluysa asgari yedek kullanılıp silinmeli. |
| Kaynak depo (GitHub) | Yalnızca kod + `client/vendor/` | Kullanıcı verisi yok. |

## 2. Render (sağlayıcı) tarafı — doğrulananlar / teyit edilmesi gerekenler

| Soru | Cevap | Kaynak/Durum |
|---|---|---|
| Otomatik disk anlık görüntüsü var mı? | **Evet: 24 saatte bir otomatik** | Render Disks dokümantasyonu — doğrulandı |
| Ne kadar süre tutulur? | **"En az yedi gün"** (üst sınır belirtilmemiş) | Doğrulandı (alt sınır); **üst sınır teyit edilmeli** |
| Şifreli mi? | **Evet, diskler ve otomatik günlük anlık görüntüleri bekleme durumunda şifreli** | Doğrulandı (anahtar yönetimi/anahtar sahibi **teyit edilmeli**) |
| Canlı DB'de silinen veri yedekte ne kadar kalabilir? | Silinen veri, silme anından önce alınmış anlık görüntülerde **süresi bilinmiyor (Render'dan doğrulanmalı; uygulama yedeği 7 gün)** (ve üst sınıra bağlı olarak daha uzun) bulunabilir; **geri yükleme yapılırsa silinmiş veri geri gelir** ve silme işlemleri yeniden uygulanmalıdır (silme kaydı içerik tutmaz) | Türetilmiş sonuç; üst sınır **teyit edilmeli** |
| Kim erişebilir? | Anlık görüntüler Render Dashboard'da servisin Disk sayfasından geri yüklenir. Erişim yetkisi Render hesabı/takım rollerine bağlıdır; Sauran'ın hesabında kimlerin yetkili olduğu **koddan bilinemez** | **Render'dan/panelden teyit edilmeli** (takım üyeleri, MFA) |
| Yedek bölgesi | Render servis bölgesi: Oregon, Ohio, Virginia (ABD), Frankfurt (Almanya), Singapur — servis oluşturulurken seçilir, sonradan değiştirilemez. Anlık görüntünün bölgesi dokümanda ayrıca belirtilmemiştir | **Panelden servis bölgesi ve Render'dan anlık görüntü bölgesi teyit edilmeli** |
| Silme yöntemi | Sauran'ın anlık görüntüyü silmesi için belgelenmiş bir API yoktur; disk/servis silinince anlık görüntülerin akıbeti dokümanda belirtilmemiştir | **Render'dan teyit edilmeli** |
| Kısmi geri yükleme | Desteklenmez (tam disk) | Doğrulandı |

## 3. Önemli beyanlar
* **Canlı veritabanından silinen veri, daha önce alınmış yedeklerde ve Render anlık görüntülerinde bir süre daha kalabilir.** Yedeklerin yaşam döngüsü canlı veritabanından ayrıdır; hesap/mesaj silme yedekleri geriye dönük değiştirmez.
* Bir yedek **geri yüklenirse** (kaza veya kurtarma) yedekten sonra silinen hesap/mesajlar yeniden görünür; kurtarma sonrası hesap silme/temizlik işleri yeniden çalıştırılmalı, geri yükleme kararı hukuki/operasyonel değerlendirme gerektirir.
* Ürün ilk açılışında geri alınamaz temizlikler çalıştırır (bkz. `docs/uretim-oncesi-kontrol.md`); bunlardan **önce** asgari yedek almak operatör kararıdır ve **7 gün** sonra silinir.

## 4. Uygulanan teknik önlemler (Aşama 18 + bu çalışma)
1. `secure_delete = ON`; WAL saatlik/kapanış kesme; `Cache-Control: no-store` (kişisel veri yanıtları).
2. `server/backup.js`: 0600/0700, `VACUUM INTO`, gizli/geçici tabloları boşaltma, `--list/--purge`, herkese açık dizin koruması.
3. Yedek/geçici dosya temizliği (açılış + günlük) — süre **14 → 7 gün** (Render anlık görüntüsü zaten ≥7 gün olduğundan elle yedeğin daha uzun tutulması için gerekçe yok).
4. `DATA_DIR` istemci dizini içindeyse sunucu **başlamaz**.
5. `.gitignore` genişletildi; yerel migration aracı depodan çıkarıldı.
6. **Boş veritabanında ilk kurulum hatası düzeltildi** (önceden `no such table: pending_verifications` ile çöküyordu; yeni disk/felaket kurtarma senaryosu).
7. Silme/imha olayları `data_lifecycle_log` ile (yalnızca sayaç) kayda alınır.

## 5. Bilinen sınırlar
* `SIGTERM` ile zarif kapanış POSIX'te (Render) çalışır; Windows'ta sinyal işleyici tetiklenmez.
* Yedek temizliği yalnızca uygulama çalışırken (açılışta + günde bir) işler.
* Render tarafı yedeklerini kodla silemeyiz/kısaltamayız; süreler Render ayarları ve hesabı üzerinden doğrulanmalıdır.
