# Yedek, anlık görüntü ve dış kopyaların yaşam döngüsü (Aşama 18)

> **Uyarı:** Bu belge yalnızca **uygulama kodundan doğrulanabilen** durumu anlatır. Barındırma sağlayıcısının (Render) disk yedeği/anlık görüntü davranışı, günlük saklama süresi ve
> konumu koddan bilinemez ve **doğrulanmalıdır**. Hukuki uygunluk garantisi vermez. Teknik süreler "teknik varsayılan"dır.

## Kod tabanındaki kopyalar (envanter)

| Kopya | Var mı | Yaşam döngüsü |
|---|---|---|
| Canlı veritabanı `sauran.db` (+ `-wal`, `-shm`) | Evet (DATA_DIR / Render diski) | Uygulama cleanup'ları. **Silinen içerik dosyada sıfırlanır** (`secure_delete = ON`, bağlantı düzeyinde); WAL saatte bir ve kapanışta (`SIGTERM`/`SIGINT`) kontrol noktasıyla kesilir. |
| Uygulamanın kendiliğinden aldığı yedek | **Hayır.** Kodda otomatik yedek/arşiv yoktur (otomatik yedek, kişisel veri kopyası sayısını artırırdı). | — |
| Elle alınan yedek (`node backup.js`) | Yalnızca operatör çalıştırırsa | `DATA_DIR/backups/`, izin 0600/0700; **asgari** yedekte oturum, bekleyen kayıt, sıfırlama kodu, push/FCM tabloları BOŞ; **7 gün** (teknik varsayılan, `BACKUP_RETENTION_DAYS`) sonra sunucu tarafından otomatik silinir. `BACKUP_CLEANUP=off` ile kapatılabilir. |
| Dışa aktarım dosyaları | Sunucuda dosya **yazılmaz**: veri bellekte üretilir, `Cache-Control: no-store` ile kullanıcıya indirilir. | Kullanıcının kendi cihazındaki kopya kullanıcının sorumluluğundadır. |
| Sunucu günlükleri | Uygulama yalnızca konsola yazar (dosya/arşiv yok). Günlüklere kullanıcı adı/e-posta/IP yazılmaz (Aşama 17). | Render günlük saklaması: **doğrulanmalı**. |
| Render disk yedeği / anlık görüntüsü | Sağlayıcıya bağlı | **Doğrulanmalı** (süre, konum, erişim). |
| Kaynak depo (GitHub) | Yalnızca kod. `.gitignore`: `data/sauran.db*`, `.env`, `google-services.json`. Vendor dosyası (`client/vendor/`) dışında ikili/veri yok. | — |
| Geliştirici ortamındaki DB kopyaları | `data/sauran.db` yerel geliştirme veritabanıdır (git dışı). | Gerçek üretim verisi geliştirme ortamına **alınmamalıdır**; zorunluysa asgari yedek kullanılmalı ve iş bitince silinmelidir. |

## Önemli beyanlar

* **Canlı veritabanından silinen veri, daha önce alınmış yedeklerde ve sağlayıcı anlık görüntülerinde bir süre daha kalabilir.** Yedeklerin yaşam döngüsü canlı veritabanından ayrıdır; hesap silme/mesaj silme yedekleri geriye dönük değiştirmez.
* **Migration öncesi yedek kalıcı bir saklama kaynağına dönüşmemelidir.** Şema/veri geçişinden önce alınan yedek, doğrulama bittiğinde silinmelidir; unutulursa `DATA_DIR/backups/` içindeki dosya 7 gün sonra kendiliğinden silinir
  (DATA_DIR kökünde `sauran.db.bak*`, `sauran.db.pre-*`, `sauran-premigration*` gibi açıkça geçici adlı eski dosyalar da). Bu kalıpların dışındaki adlarla bırakılan dosyalar silinmez; operatör sorumluluğundadır.
* **Geri yükleme sonrası:** Bir yedek geri yüklenirse, yedek alındıktan sonra silinen hesap/mesajların yeniden görünmemesi için silme işlemlerinin yeniden uygulanması gerekir
  (silme kaydı tutulmaz; bu nedenle yedek geri yükleme kararı hukuki/operasyonel değerlendirme gerektirir).
* **Erişim:** Yedek dosyaları yalnızca sunucu hesabının okuyabileceği izinle yazılır. Render disk yedeğine kimlerin eriştiği koddan bilinmez (**doğrulanmalı**).

## Uygulanan teknik önlemler (bu aşama)

1. `secure_delete = ON` (bağlantı düzeyinde) + bakım fonksiyonları artık kapatmıyor: silinen kişisel veri (mesaj, medya, hesap) veritabanı sayfalarında artık kalmaz.
2. WAL saatte bir ve kapanışta kesilir (`checkpointWal`, `gracefulShutdown`).
3. `server/backup.js`: asgari/tam yedek aracı (0600, `VACUUM INTO`, gizli tabloları boşaltma) ve süresi dolan yedeklerin otomatik temizliği (açılış + günlük).
4. Kişisel veri taşıyan API yanıtları ve dışa aktarım `Cache-Control: no-store`.

## Bilinen sınırlar

* `SIGTERM` ile zarif kapanış POSIX'te (Render) çalışır; Windows'ta sinyal işleyici tetiklenmez (yalnızca saatlik kesme geçerli).
* Yedek temizliği yalnızca uygulamanın çalıştığı süre boyunca çalışır (açılışta ve günlük).
* Sağlayıcı tarafı yedeklerini kodla kontrol edemeyiz; süreleri operatörce doğrulanmalıdır.
