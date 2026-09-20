# Rapor ve Kanıt Saklama Politikası (teknik)

> ## Bu süreler onaylı değildir
> Aşağıdaki süreler (7 / 30 / 90 / 180 / 365 / 730 gün) **KVKK Kurumu ya da başka bir makam tarafından onaylanmış,
> öngörülmüş veya tavsiye edilmiş süreler değildir.** Yalnızca **teknik varsayılanlardır** ve uygulamanın çalışabilmesi için
> seçilmiştir. Gerçek azami saklama süreleri; her veri kategorisinin **işleme amacına** ve **hukuki sebebine** göre, bir hukuk
> danışmanıyla belirlenmeli ve doğrulanmalıdır. Bu belgedeki "hukuki sebep" sütunu **hipotezdir**, hukuki görüş değildir.
> Süreler `server/db.js` içindeki `RETENTION_POLICY` sabitinde tutulur; hukuki değerlendirme sonucunda değişecekse tek yerden
> değiştirilir.

## Amaç ve ilke

Bir mesaj raporlandığında, mesajı yazan kişi mesajı silse ya da hesabını kapatsa bile moderasyon incelemesinin
boşa çıkmaması için **yalnızca gerekli minimum** veri, **süreli** olarak korunur. Hiçbir kategori süresiz saklanmaz;
rapor, kanıt ve medya süreleri `max_days` (730 gün) ile sınırlıdır (yaşam döngüsü logu ayrı bir süreye tabidir, aşağıya bakın).

## Veri kategorileri

| Kategori | Tablo | İşleme amacı | Hukuki sebep (hipotez — doğrulanmalı) | Açık rapor | Reddedildi | İşlem yapıldı |
|---|---|---|---|---|---|---|
| Kanıt medyası (ses/görsel/video/dosya) | `report_evidence_media` | Raporlanan ekin incelenmesi | Meşru menfaat (platform güvenliği) | 90 gün | 7 gün | 180 gün |
| Kanıt metni + minimum metadata | `report_evidence` | Raporlanan mesajın raporlandığı andaki halinin incelenmesi | Meşru menfaat (taciz/tehdit/çocuk güvenliği ile mücadele) | 180 gün | 30 gün | 365 gün |
| Rapor kaydı (neden, durum, açıklama, moderasyon geçmişi) | `reports`, `moderation_actions` | Raporun yürütülmesi, itiraz ve tekrarlayan ihlal değerlendirmesi | Meşru menfaat; olası hukuki yükümlülükler | 365 gün | 90 gün | 730 gün |
| Yaşam döngüsü logu (silme/yok etme/anonimleştirme olayları) | `evidence_lifecycle_log` | Silme işlemlerinin denetlenebilirliği | Hesap verebilirlik; silme/yok etme kayıtlarının saklanması yükümlülüğü (doğrulanmalı) | **en az 3 takvim yılı** (sabit gün sayısı değil) — tüm durumlarda aynı | | |

- **Süre başlangıcı:** açık raporda rapor tarihinden; kapatılmış raporda kapanış (durum değişikliği) tarihinden.
  Durum değişince üç süre yeniden hesaplanır (`refreshRetention`).
- **Sıralama kuralı:** medya ≤ kanıt metni ≤ rapor kaydı. Kanıt, kendi raporundan uzun yaşayamaz.
- **Yaşam döngüsü logu ayrı bir yaşam döngüsüdür:** rapor, kanıt ve medya temizliği bu kaydı **silmez** (loga bağlı bir
  yabancı anahtar / kaskad yoktur; `report_id` yalnızca bir referanstır). Log en az 3 **takvim yılı** (`lifecycle_log_years = 3`)
  saklanır: kayıt, oluşma tarihinden itibaren tam 3 takvim yılı geçmeden silinmez (artık yıllarda 1095 gün üç yılı garanti
  etmediği için sabit gün sayısı kullanılmaz; 29 Şubat'ın karşılığı olmayan yılda 28 Şubat esas alınır, yani daha uzun saklanır).
  Yalnızca bu süre dolunca silinir. `max_days` (730) üst sınırı log için **geçerli değildir**. Silme/yok etme/
  anonimleştirme kayıtlarının en az 3 yıl saklanması gerektiği bilgisi tarafımızca hukuki olarak doğrulanmamıştır;
  hukuk danışmanıyla teyit edilmelidir. Log içinde yalnızca olay türü, zaman, rapor referansı ve sayılar bulunur; mesaj
  içeriği, kullanıcı adı, e-posta, IP, profil bilgisi ya da medya yolu **yoktur**.
- **`retention_until`:** `reports`, `report_evidence` ve `report_evidence_media` tablolarında ayrı ayrı tutulur.

## Rapor kategorisine göre süre uzatma YOKTUR

Taciz, tehdit, çocuk güvenliği dahil **hiçbir rapor nedeni** saklama süresini otomatik uzatmaz; tüm nedenler aynı süreleri
kullanır (`reason_overrides` gibi bir mekanizma kaldırılmıştır). Özel nitelikli veri içerebilecek bu kategoriler için ayrı
bir süre gerekirse, önce **hukuki dayanağı ve azami süresi belgelenmeli**, ardından bu tabloya ve bu belgeye açıkça
eklenmelidir. Kodda "daha uzun sakla" varsayımı yapılmaz. Çocuk kullanıcılar, taciz/tehdit raporları ve medya için ayrı bir
politika çalışması gerekir (KVKK'da özel nitelikli kişisel veriler için ek işleme şartları ve yeterli önlemler bulunur;
bu değerlendirme yapılmadan bu belgedeki süreler bu kategoriler için nihai kabul edilmemelidir).

## Neler saklanır / saklanmaz

Kanıt metni kaydında: mesajın metni, türü, hafif ek bilgileri (ör. dosya adı), mesaj ve rapor zamanı, lobi adı ya da "DM"
bilgisi, bütünlük özeti (SHA-256) ve **iç kimlik numaraları**.

Saklanmaz: **kullanıcı adı (gönderen, alıcı, raporlayan)**, e-posta, doğum tarihi, profil/kapak fotoğrafı, "hakkımda", IP adresi,
cihaz bilgisi. Panel, kullanıcı adını hesap varken kimlik numarasından **canlı** çözer; hesap silinince kimlik NULL olur ve
ad hiçbir yerde kalmaz. (Gerekçe: gönderen kullanıcı adı kopyasını tutmak için, hesap silindikten sonra da gerekli olan somut
bir moderasyon ihtiyacı belirlenmedi; veri minimizasyonu gereği kopya tutulmuyor. Böyle bir ihtiyaç doğrulanırsa ayrıca ve
gerekçesiyle eklenmelidir.) Mesajın kendi metni başka kullanıcıların adını içerebilir (ör. anma); bu, içeriğin doğasından
kaynaklanır ve kanıtın parçasıdır.

Yaşam döngüsü logu yalnızca olay türü, zaman, rapor id'si ve sayaçlar içerir; mesaj içeriği, kullanıcı adı/id'si, e-posta, IP, profil bilgisi ya da medya yolu içermez.

## Hesap silme

"Hesabımı Sil" akışı normal hesap verilerini (mesajlar, arkadaşlıklar, üyelikler, oturumlar, bildirimler…) siler.
Rapor ve kanıt kayıtları **fiziksel olarak silinmez**, ancak süre dolana kadar:

- Raporlayan siliniyorsa `reports.reporter_user_id = NULL`, `reporter_account_deleted = 1`.
- Mesaj sahibi siliniyorsa `report_evidence.sender_id = NULL`, `sender_account_deleted = 1`.
- DM alıcısı siliniyorsa `report_evidence.to_user_id = NULL`, `recipient_account_deleted = 1`.
- `retention_until` değerleri **değişmez**; süre dolunca kayıtlar otomatik silinir.

Silme yerine "anonimleştirme" seçilmemiştir: rapor hedefi ve içerik metni tek başına kişiyi belirlemeye yetebileceğinden,
gerçekten anonim olduğu iddia edilemez.

## Medya

Sauran'da medya dosya değil, mesajın `payload` alanında base64 olarak tutulur. Normal mesaj silme `payload`'ı siler.
Kanıt için medya, **ayrı** `report_evidence_media` tablosunda, kendi (daha kısa) `retention_until` süresiyle korunur.
İki yaşam döngüsü **tamamen bağımsızdır**: mesajı silmek kanıt medyasını silmez; kanıt medyasının imhası canlı mesaja
dokunmaz. 6 MB'ı aşan medya kopyalanmaz (`too_large`); metin kanıtı yine yazılır.

## Temizlik ve imha (canlı veritabanı)

`purgeExpiredRetention()` açılışta ve günde bir çalışır; yalnızca `retention_until` üzerinden karar verir.
Sıra: medya → kanıt metni → rapor kaydı (moderasyon geçmişi CASCADE ile birlikte). Silme sırasında SQLite
`secure_delete` açılır (silinen içerik sayfada sıfırlanır) ve WAL dosyası kırpılır (`wal_checkpoint(TRUNCATE)`).

## Yedekler ve anlık görüntüler (backup / snapshot)

**Üretim veritabanından silinmesi ile yedekten imha edilmesi farklı yaşam döngüleridir.** Bu uygulama yalnızca canlı
veritabanını temizler. Barındırma sağlayıcısının (Render) disk anlık görüntüleri ve varsa kendi aldığımız yedekler:

- Süresi dolmuş kanıtı, **kendi saklama süreleri dolana kadar** içerebilir; uygulama bunları silemez ve seçici silme yapılamaz.
- Yedek saklama süresi, sağlayıcının **gerçek ve güncel politikasına** bağlıdır; bu belge bunu **doğrulamamıştır**.
  Yayın öncesinde Render'ın disk snapshot saklama süresi ve (kullanılıyorsa) veritabanı/disk yedek ayarları kontrol edilmeli,
  bizim aldığımız dışa aktarımların ne kadar saklandığı ayrıca belirlenmelidir.
- **Geri yükleme koruması:** `retention_until` veritabanında saklandığından, eski bir yedek geri yüklendiğinde sunucu açılışta
  `purgeExpiredRetention()` çalıştırır ve süresi dolmuş kanıt/medya/raporlar canlı veritabanından **yeniden silinir**.
  Ancak geri yüklenen yedek dosyasının kendisi silinmez.
- Yapılandırılması gereken nokta: yedek saklama süresi, en uzun kanıt süresini (730 gün) aşmayacak şekilde ve mümkünse çok
  daha kısa tutulmalı; kullanılmayan eski dışa aktarımlar/yedekler düzenli olarak imha edilmelidir. Bu, sağlayıcı ayarı ve
  operasyonel süreçtir, kodla çözülemez.

## Erişim

Kanıta yalnızca moderatör ve üzeri platform rolleri, `/api/moderation/*` uçları üzerinden erişir (API seviyesinde
`requirePlatformRole`). Raporlayan, raporlanan ya da sıradan kullanıcı erişemez. "Verilerimi İndir" çıktısında
başkalarına ait mesaj içeriği ya da kanıt bulunmaz: kanıt üçüncü kişilerin (mesaj sahibi, karşı taraf) verisini içerir
ve moderasyon amacıyla tutulur; kullanıcının kendi hesabının erişim hakkı kapsamı dışındadır. Kullanıcı yalnızca kendi
açtığı raporların temel bilgisini (tür, neden, durum, tarih) indirir.

## Eski raporlar (migration)

Bu özellikten önce açılmış raporlar için geriye dönük kanıt **üretilmez**; panel "Kanıt kaydı bulunmuyor" gösterir.

Migration bu raporlara `retention_until`'i politikayı **kendi tarihlerinden** (açık rapor: açılış; kapatılmış rapor:
kapanış tarihi) uygulayarak hesaplar. **Ek süre tanınmaz:** `legacy_migration_grace_days` varsayılanı **0**'dır, çünkü
otomatik bir ek saklama süresinin hukuki gerekçesi yoktur. Sonuç:

- Politika süresi **zaten geçmiş** eski raporlar, güncelleme yayına alınıp sunucu ilk açıldığında çalışan temizlikte
  (moderasyon geçmişleriyle birlikte) **silinir; bu geri alınamaz.**
- Süresi geçmemiş eski raporlar kendi hesaplanan tarihlerine kadar saklanır.
- Silinen her rapor `evidence_lifecycle_log`'a `report_purged` olarak yazılır; etkilenen eski rapor sayısı
  `legacy_retention_assigned` olayında (yalnızca sayı ve `grace_days`) görünür.

**Ayrı operasyonel güvenlik önlemi:** güncelleme yayınlanmadan **önce** veritabanı yedeği alınmalıdır. Bu bir saklama süresi
değil, geri dönüş (rollback) önlemidir: yedek, yayın sonrası fark edilen bir hata için tutulur; ve kendi saklama ömrü
sınırlı olmalı, iş bitince imha edilmelidir (bkz. "Yedekler ve anlık görüntüler"). Ek süre yalnızca bilinçli bir operasyonel
tercih olarak `legacy_migration_grace_days` > 0 yapılarak tanınabilir; bu, hukuki bir süre değildir.

## Yayın öncesi notlar (deploy)

- **Deploy öncesi Render veritabanı/disk yedeği alınmalıdır** (migration `reports` tablosunu yeniden oluşturur ve tarihi geçmiş
  eski raporlar ilk açılışta silinir; geri alınamaz).
- **Render yedek/anlık görüntü saklama süresi ayrıca teyit edilmelidir** (sağlayıcının güncel politikası; bu belge doğrulamamıştır).
  Yedeklerdeki süresi dolmuş kanıtın imhası, canlı veritabanı temizliğinden ayrı bir yaşam döngüsüdür.
- Süreler (7/30/90/180/365/730 gün) ve yaşam döngüsü logunun 3 yıl gereği hukuk danışmanıyla doğrulanmalıdır.
