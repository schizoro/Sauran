# Final tutarlılık denetimi (Aşama 8)

> Teknik denetimdir; hukuki uygunluk beyanı değildir. Hukuki noktalar "hukuki doğrulama gerekli" olarak işaretlidir.

| # | Soru | Bulgu |
|---|---|---|
| 1 | Kodda var, politikada yok | Aşama 7 değişiklikleri (giriş şartlı profil ucu, aynı-origin CORS, hız sınırları) kişisel veri işleme türü değiştirmez; politika metni değişikliği gerekmez. Diğerleri Aşama 1–6'da politikaya işlendi. |
| 2 | Politikada var, kodda yok | `consistency21_suite` ve `lifecycle20_suite` ile süre/mekanizma eşleşmesi test edilir; açık uyuşmazlık yok. |
| 3 | Hesap silme sonrası gizli kopya | Atomik silme + 33 sütunluk yetim taraması temiz. Kalan: 90 gün DM (karşı taraf), kanıt (bağı kopuk), yedekler ≤ 7 gün. |
| 4 | Silinmiş mesaj kopyaları | Forward kopyaları, tepki/oy/sabit, WAL (`secure_delete`, checkpoint) kapatıldı; yedeklerde ≤ 7 gün kalabilir. |
| 5 | Süresi dolan veri temizliği | Tüm periyodik işler `data_lifecycle_log`'a sayı yazar; `INDEFINITE_RETENTION` süresizleri kapatır. |
| 6 | Yedek/snapshot | Uygulama yedeği 7 gün + asgari içerik; Render disk anlık görüntüleri **sağlayıcı tarafında, bilinmiyor** (bkz. yedekleme belgesi). |
| 7 | Kanıt yanlışlıkla silinir mi | Normal mesaj saklama kanıt tablosuna dokunmaz (`tomb_evidence_suite`). |
| 8 | Kanıt fazla veri | Kullanıcı adı, e-posta, IP, doğum tarihi kopyalanmaz. |
| 9 | Denetim günlüğü | Yalnızca kimlik numaraları, eylem, gerekçe; 90 gün gerekçe / 365 gün kayıt. |
| 10 | Bildirim yükleri | FCM/Web Push yalnızca genel metin + tür; TTL 1 saat. |
| 11 | Daily | Kullanıcı adı gönderilmez; token 4 saat; oda temizlik kuyruğu. |
| 12 | E-posta | Doğrulama/sıfırlama/uyarı e-postaları asgari; rol kararı ekip e-postasında `Hesap #id`. |
| 13 | Export başka kullanıcı verisi | Yalnızca kendi verisi; doğum tarihi yok, `age_group` var (`kvkk_suite`). |
| 14 | Hesap silme başkasının verisini siler mi | Başkasının hub'ı/mesajları korunur; oda sahipliği devredilir, FK'ler NULL'lanır. |
| 15 | Çocuk görünürlüğü | Yabancıya avatar/kapak/biyografi/çevrimiçi/DM kapalı (`child4`, `child19`). |
| 16 | Hassas veri kopyası | Analiz/sınıflandırma yok; görsel üstverisi temizlenir; kanıta asgari kopya. |
| 17 | Yurt dışı aktarım | Render, Zoho, Daily, Firebase/Google (Web Push için tarayıcı push servisleri): yurt dışı olabilir; mekanizma (standart sözleşme/bildirim vb.) **hukuki doğrulama gerekli**, sözleşme imzalanmadı, Kurum'a bildirim yapılmadı. |
| 18 | Hukuki onay gereken süreler | Mesaj 90/365/730 gün, kanıt 30/180/365, bildirim/denetim 90–730, hareketsiz hesap 730+30, davet 7, log ≥ 3 yıl. |
| 19 | Yedek sağlayıcı süreleri | Render disk/snapshot süresi, şifreleme ve erişim; Zoho posta kutusu saklaması; Daily kayıt/log saklaması; Firebase. Hepsi sağlayıcıdan doğrulanmalı. |
| 20 | Gerçek üretim engeli | Kod engeli yok. Operasyonel: `DATA_DIR` kalıcı disk, SMTP anahtarı, ilk açılış geri alınamaz temizlik için yedek + `--impact`, gerçek cihaz testleri, tek örnek varsayımı. |
