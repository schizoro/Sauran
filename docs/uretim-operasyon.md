# Üretim operasyon rehberi (kapalı beta)

> Sır DEĞERLERİ bu belgede yoktur ve olmamalıdır. Yalnızca değişken adları ve "ayarlı/eksik" mantığı yer alır.

## 1. Mimari özeti
- Tek Node.js süreci (Express + Socket.io) — Render web servisi, **tek örnek** (hız sınırları bellektedir; ölçeklendirme yapılırsa gözden geçirilmeli).
- Veritabanı: SQLite (`DATA_DIR/sauran.db`, WAL), Render **kalıcı diski** üzerinde.
- Dış servisler: Render (barındırma), Daily (sesli oda), Zoho SMTP (e-posta), Firebase FCM (Android bildirimi), tarayıcı push servisleri (Web Push).
- Render'da **otomatik deploy kapalı**: push sonrası Dashboard → Manual Deploy → *Deploy latest commit*.

## 2. Sağlık ve izleme
| Ne | Nasıl |
|---|---|
| Canlılık | `GET https://sauran.online/healthz` → `200 {"status":"ok","db":"ok","uptime_s":…}`; veritabanı yanıt vermezse `503`. Render → Settings → *Health Check Path* olarak `/healthz` verilebilir. |
| İşletme özeti | Founder/admin girişiyle `GET /api/admin/health`: süreç (çalışma süresi, bellek), veritabanı boyutu/WAL, gerçek zamanlı bağlantı sayısı, servislerin yapılandırılıp yapılandırılmadığı, son yedek yaşı, off-site durumu, yapılandırma uyarıları. Kişisel veri/sır içermez. |
| Günlükler | Render → Logs. Şifre, oturum belirteci, çerez, sıfırlama kodu, API anahtarı, SMTP parolası **yazılmaz** (`ops_suite` kaynak taramasıyla denetlenir). |
| Hata izleme | Ayrı bir hata izleme servisi (Sentry vb.) **YOKTUR**; hatalar Render günlüğündedir. Kapalı beta için yeterli, genel açılış için önerilir. |

Başlangıç günlüğündeki `[yapılandırma warn/error]` satırları eksik/riskli ayarları listeler.

## 3. Önemli ortam değişkenleri (Render → Environment)
| Değişken | Gerekli | Etkisi |
|---|---|---|
| `NODE_ENV=production` | Evet | CORS aynı-origin, sıkı ayarlar, **otomatik yedek açılır** |
| `DATA_DIR` | Evet | Kalıcı disk yolu (yoksa veri her deploy'da kaybolur) |
| `ZOHO_EMAIL_PASSWORD` | Evet | Doğrulama/sıfırlama/rapor e-postaları |
| `DAILY_API_KEY` | Evet | Sesli odalar |
| `FIREBASE_SERVICE_ACCOUNT_JSON`/`_BASE64` | Android bildirimi | FCM |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Tarayıcı/iPhone bildirimi | Web Push |
| `REPORT_EMAIL_TO`, `PUBLIC_BASE_URL=https://sauran.online` | Önerilir | Rapor e-postası alıcısı ve panel bağlantısı |
| `BETA_INVITE_REQUIRED=off` | Hayır | **Yalnızca acil durum**: davet kodu şartını ortam düzeyinde kapatır (panel ayarını geçersiz kılar) |
| `AUTO_BACKUP=off` | Hayır | Otomatik yedeği kapatır (varsayılan: üretimde açık) |
| `BACKUP_KEEP`, `BACKUP_RETENTION_DAYS` | Hayır | Yedek adedi (7) / gün (7) |
| `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`, `BACKUP_S3_REGION`, `BACKUP_S3_PREFIX`, `BACKUP_ENCRYPTION_KEY` | Off-site için | Şifreli uzak yedek (bkz. §4.3) |

## 4. Yedek ve kurtarma
### 4.1 Katmanlar
1. **Render disk anlık görüntüsü:** 24 saatte bir otomatik, en az 7 gün (Render dokümantasyonu; üst sınır/şifreleme anahtarı sahipliği teyit edilmeli). Dashboard → servis → Disk → Snapshots.
2. **Uygulama yedeği:** günde bir, `DATA_DIR/backups/`, asgari (oturum/cihaz anahtarı/bildirim tabloları boş), bütünlük denetimli, `.sha256` sağlama toplamlı, en fazla 7 adet/7 gün.
3. **Off-site (şifreli):** YAPILANDIRILDIYSA günlük yedek AES-256-GCM ile şifrelenip S3 uyumlu depoya yüklenir. **Şu an yapılandırılmamıştır → uzak kopya yoktur.**

> Aynı diskteki yedek tek başına felaket kurtarma değildir (disk/hesap kaybında yedek de gider). Gerçek koruma için off-site şarttır.

### 4.2 Elle komutlar (Render → Shell)
```bash
node server/backup.js                       # asgari yedek al (doğrulanır, sha256 yazılır)
node server/backup.js --list                # yedekleri listele
node server/backup.js --verify <dosya>      # sağlama toplamı + integrity_check
node server/backup.js --restore <dosya> --to <hedef>   # doğrular, hedefe kopyalar (var olanın üzerine yazmaz)
node server/backup.js --auto                # günlük işin aynısı (off-site dahil)
```

### 4.3 Off-site yapılandırma sözleşmesi
Herhangi bir S3 uyumlu depolama (Cloudflare R2, Backblaze B2, AWS S3, MinIO). Gerekenler (değerleri yalnızca siz Render'a girin):
`BACKUP_S3_ENDPOINT` (https://…), `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`, `BACKUP_ENCRYPTION_KEY` (≥16 karakter parola; **kaybolursa yedek çözülemez, parola yöneticisinde saklayın**). Bölge varsayılanı `auto`, önek `sauran/`.
Eksikler `/api/admin/health → backup.offsite.missing` alanında adlarıyla görünür.

### 4.4 Geri yükleme prosedürü (veritabanı bozulursa / veri kaybolursa)
1. **Hizmeti durdurun** (Render → Suspend) — canlı DB üzerine yazmadan önce.
2. Elde hangi yedek var? (`--list`; off-site ise `.enc` dosyasını indirip çözün: `offsite.decrypt` — Node ile `BACKUP_ENCRYPTION_KEY` kullanarak.)
3. `node server/backup.js --verify <yedek>` → BAŞARILI olmalı.
4. Mevcut `sauran.db` (+`-wal`,`-shm`) dosyalarını **silmeden** başka bir ada taşıyın.
5. `node server/backup.js --restore <yedek> --to $DATA_DIR/sauran.db`.
6. Hizmeti başlatın; `/healthz` ve `/api/admin/health` ile kontrol edin. Asgari yedek olduğu için **tüm kullanıcılar yeniden giriş yapar** (oturum tablosu boş) ve bildirim aboneliklerini yenilemeleri gerekir.
7. Alternatif: Render disk anlık görüntüsünden geri yükleme (tam disk).

**Restore testi (yapıldı, otomatik):** `ops_suite` yedeği geçici dizinde alır, bozulma tespitini, geri yüklemeyi (hedef DB açılır, aynı satır sayıları) ve üzerine yazma korumasını sınar. Üretim veritabanı üzerinde restore denenmemiştir (bilinçli).

## 5. İlk açılış temizlikleri
Yeni sürüm ilk kez üretim verisiyle açıldığında geri alınamaz temizlikler çalışabilir (`docs/uretim-oncesi-kontrol.md`). **Deploy öncesi Render Disk → Snapshots'tan elle snapshot alın** (otomatik yedek bu temizliklerden ÖNCE çalışamaz).

## 6. Bir şey bozulursa
| Belirti | Kontrol |
|---|---|
| Site açılmıyor | Render → Events/Logs; `/healthz` yanıtı; son deploy başarılı mı |
| `/healthz` 503 | Disk dolu mu, `DATA_DIR` bağlı mı, veritabanı dosyası bozuk mu (yedekten geri yükleme) |
| Kimse giriş/kayıt yapamıyor | `ZOHO_EMAIL_PASSWORD` (kayıt kodu e-postası), beta davet modu (`BETA_INVITE_REQUIRED`) |
| Sesli oda çalışmıyor | `DAILY_API_KEY`, Daily hesabı limiti/durumu |
| Bildirim yok | FCM (Android) / VAPID (tarayıcı, iPhone); sayfa görünürken push gönderilmez (tasarım) |
| Rapor e-postası gelmiyor | `REPORT_EMAIL_TO`, Zoho |

## 7. Hangi servis kesilirse ne olur
Render: uygulama tamamen kapanır. Daily: yalnızca sesli odalar. Zoho: kayıt/şifre sıfırlama/rapor e-postaları. Firebase/push servisleri: yalnızca uygulama kapalıyken bildirim. Off-site depo: yalnızca uzak yedek (uygulama çalışır).
