# Saklama sürelerinin hukuki dayanaklarla eşleştirilmesi

> **Bu belge, sürelerin KVKK tarafından zorunlu kılındığını İDDİA ETMEZ ve hukuki görüş değildir.** Aşağıdaki süreler Sauran'ın **teknik varsayılanlarıdır**.
> Belgenin amacı, her sürenin **amacını**, **olası hukuki işleme şartını** ve **hukuki karar gereken noktaları** ayırmaktır. Resmî metinler yayın öncesinde
> yeniden okunmalıdır (mevzuat değişebilir). Güncel Eylül 2026 kontrolünde başvurulan kaynaklar en altta listelenmiştir.

## 1. Çerçeve (resmî kaynaklardan özet)

| Konu | Ne diyor | Sauran için anlamı |
|---|---|---|
| **6698 sayılı KVKK m. 4/2-(ç)** | Kişisel veriler ilgili mevzuatta öngörülen **veya işlendikleri amaç için gerekli olan süre kadar** muhafaza edilir. | Genel bir "X gün" kuralı **yoktur**; süre amaçla ölçülüdür ve gerekçelendirilmelidir. |
| **KVKK m. 7** | İşlenmesini gerektiren sebepler ortadan kalkınca veri silinir, yok edilir veya anonim hale getirilir. | Süre dolunca cleanup gerekir (kodda uygulanıyor). |
| **KVKK m. 5/2** (işleme şartları) | Kanunlarda açıkça öngörülmesi; sözleşmenin kurulması/ifası; hukuki yükümlülük; ilgili kişinin temel haklarına zarar vermemek kaydıyla **meşru menfaat**; bir hakkın tesisi, kullanılması veya korunması; (m. 5/1) açık rıza vb. | Aşağıdaki "olası şart" sütunu **yalnızca olası adayları** gösterir; nihai seçim veri sorumlusunun hukuki kararıdır. |
| **Silme, Yok Etme, Anonim Hale Getirme Yönetmeliği** (RG 28.10.2017) | VERBİS'e kayıtlı veri sorumluları saklama ve imha politikası hazırlar; **periyodik imha aralığı en fazla 6 ay**; silme/imha işlemlerinin **kayıtları en az 3 yıl** saklanır. (Ikincil kaynaktan; metin teyit edilmeli.) | Sauran temizlikleri açılışta + saatlik/günlük çalışır (6 ay üst sınırından çok kısa). Silme kayıtları `evidence_lifecycle_log` ve yeni `data_lifecycle_log` ile en az 3 takvim yılı tutulur. |
| **5651 sayılı Kanun m. 5** | **Yer sağlayıcı**, sağladığı hizmete ilişkin **trafik bilgisini** (IP, zaman, hizmet türü vb.) yönetmelikte belirlenen **1 yıldan az 2 yıldan çok olmamak** üzere saklar. (İkincil kaynaklar; metin teyit edilmeli.) | Sauran kullanıcı içeriğine yer sağlar; **yer sağlayıcı sayılıp sayılmadığı ve trafik/IP kaydı tutma yükümlülüğünün doğup doğmadığı HUKUKİ KARAR** gerektirir. Uygulama IP'yi veritabanında kalıcı saklamaz (Render erişim günlükleri hariç). Kod bu konuda **kendi başına IP saklama kararı vermez.** |
| **VERBİS / saklama-imha politikası** | Kayıt yükümlülüğü ve muafiyetler Kurul kararlarıyla belirlenir. | Sauran'ı işleten tarafın VERBİS'e kayıt yükümlülüğü **hukuki değerlendirme** gerektirir. |
| **Borçlar/medeni hukuk zamanaşımı süreleri** | Bir hakkın tesisi/korunması için delil saklama süreleri zamanaşımlarına bağlanabilir. | Rapor kanıtı/kayıt süreleri (365–730 gün) için **teorik** bir gerekçe olabilir; hangi uyuşmazlık türü için ne kadar süre saklanacağı hukuki karardır. Kod süre **uzatmaz**. |

## 2. Süre tablosu

**Okuma notu:** "Azaltılabilir mi" = amaç için gerekli olandan kısa yapılabilir mi; "Uzatma gerekçesi" = süreyi uzatmayı haklı kılacak somut gerekçe var mı.
Tüm satırlarda erişim ayrıca **sunucu/operatör (Render erişimi)** ve DB dosyasını okuyabilen kişileri kapsar.

| Veri | Teknik süre | Veri türü / ilgili kişi / amaç | Erişebilen | Neden bu süre | Olası işleme şartı | Azaltma | Uzatma gerekçesi | Hukuki doğrulama |
|---|---|---|---|---|---|---|---|---|
| **sessions** | 7 gün | Oturum belirteci özeti, UA; kullanıcı; oturum sürekliliği | Kullanıcı, sunucu | Kullanıcının haftalık yeniden girişi zorunlu olmasın | Sözleşmenin ifası / meşru menfaat (güvenlik) | Evet, ürün kararıyla kısalır | Yok | Düşük |
| **verification / password_resets** | 10 dk, 5 deneme | Kod özeti; kayıt/sıfırlama sahibi | Sunucu | Kısa ömür güvenlik gereği | Sözleşme öncesi işlem / meşru menfaat | Zaten minimum | Yok | Hayır |
| **messages — medya** | 90 gün | Ses/görsel/video/dosya; gönderen+alıcılar; sohbet | Sohbet tarafları | En ağır/hassas veri; sohbette geriye dönük medya ihtiyacı sınırlı | Sözleşmenin ifası (sohbet hizmeti) | **Kısalabilir** (ürün kararı) | Yok | **Evet** (özel nitelikli içerik riski) |
| **messages — metin** | 365 gün (sohbetin en yeni 200 mesajı hariç; sabitler hariç) | Metin; gönderen+alıcılar | Sohbet tarafları | Görünür geçmiş korunur; kullanıcıya zaten gösterilmeyen eski mesaj silinir | Sözleşmenin ifası | Evet (ürün kararı) | Yok | **Evet** |
| **inactive chat** | 730 gün | Hareketsiz sohbetin tüm mesajları | Sohbet tarafları | "Son 200" koruması sonsuz olmasın | Sözleşmenin ifası; ölçülülük | **Kısalabilir** (ör. 365) | Yok | **Evet** |
| **deleted-account DM** | 90 gün (hesap silme anından) | Karşı tarafın **kendi** mesajları; sağ kalan kullanıcı | Sağ kalan kullanıcı | Sağ kalan kullanıcı sohbetini görme/indirme süresi bulsun | Sağ kalan kullanıcı için sözleşmenin ifası / meşru menfaat | Evet (ör. 30) | Yok | **Evet** |
| **reports (kayıt)** | Reddedilen 90 / açık 365 / işlem yapılan 730 gün (üst sınır 730) | Rapor + serbest açıklama; raporlayan, raporlanan; moderasyon | **Yalnızca yetkili moderasyon** | Tekrar eden ihlal ve itiraz incelemesi | Meşru menfaat (platform güvenliği); hakkın tesisi/korunması | Açık raporda 365 → 180 makul (**yapılmadı**; rapor sistemi kilitli kabul edildi) | 730 gün için somut uyuşmazlık gerekçesi **belgelenmemiş** | **Evet** |
| **report_evidence** | Reddedilen 30 / açık 180 / işlem yapılan 365 gün | Raporlandığı andaki mesaj metni; gönderen; moderasyon | Yalnızca yetkili moderasyon | Silinen içeriğin incelemeyi boşa çıkarmaması | Meşru menfaat; hakkın tesisi | Kısmen | 365 gün: zamanaşımı/uyuşmazlık gerekçesi **hukuki karar** | **Evet** |
| **report_evidence_media** | 7 / 90 / 180 gün | Medya kanıtı (özel nitelikli olabilir) | Yalnızca yetkili moderasyon | En hassas veri: en kısa | Meşru menfaat; hakkın tesisi | Evet | Yok | **Evet** |
| **evidence_lifecycle_log** | ≥ 3 takvim yılı | Silme olayı + sayaç (kişisel veri yok) | Sunucu/yetkili | Silme işlemlerinin kaydı (Yönetmelik: en az 3 yıl — teyit) | Hukuki yükümlülük (teyit) | **Hayır** (asgari süre) | — | Teyit |
| **data_lifecycle_log** (yeni) | ≥ 3 takvim yılı | Diğer silme/imha olayları + sayaç (kişisel veri yok) | Sunucu/yetkili | Aynı | Aynı | Hayır | — | Teyit |
| **notifications** | 7 / 30 / 60 / 90 gün | Bildirim kaydı (gönderen adı/kimliği); alıcı kullanıcı | Alıcı kullanıcı | Bildirim listesi kısa ömürlü | Sözleşmenin ifası | Zaten kısa | Yok | Düşük |
| **role_notice_email_outbox** | 7 gün | Teknik kayıt (içerik yok) | Sunucu | Yeniden deneme penceresi | Meşru menfaat | Zaten kısa | Yok | Düşük |
| **admin_audit_log** | Gerekçe 90 / kayıt 365 gün | Yetkili işlem kaydı; personel + hedef hesap no | Yalnızca kurucu | Yetki kötüye kullanımı denetimi | Meşru menfaat; hukuki yükümlülük (varsa) | Evet | 365 gün üstü için gerekçe yok | **Evet** |
| **Elle alınan yedek** | **7 gün** (14'ten azaltıldı) | Kişisel veri içeren DB kopyası; tüm kullanıcılar | Operatör | Migration/geri dönüş doğrulaması; Render anlık görüntüsü de ≥7 gün | Meşru menfaat (kurtarma); güvenlik önlemi | Zaten kısa | Yok | **Evet** (Render yedeği ayrı) |
| **minor_until** | 18. yaş gününe kadar | 18 yaş altı hesapta 18. doğum günü | Sunucu | Korumalı modun günü doğru bitmesi | Yasal yükümlülük/meşru menfaat (çocuk koruması) | Hayır | — | **Evet** (çocuk verisi) |
| **FCM / Web Push iletisi** | TTL 1 saat | Genel bildirim; cihaz | Sağlayıcı | Çevrimdışı cihaza kısa teslim penceresi | Sözleşmenin ifası | Zaten kısa | Yok | Sağlayıcı tarafı teyit |
| **Daily giriş belirteci** | 4 saat | Oda girişi | Daily | Oturum uzunluğu | Sözleşmenin ifası | Evet (ör. 2 saat) | Yok | Düşük |
| **Daily silme kuyruğu** | Başarıya kadar (aralık ≤ 6 saat) | Oda adları (sayısal kimlik) | Sunucu | Sağlayıcıdaki oda silinsin | KVKK m.7 (silme) | — | — | Düşük |

Satırlarda görünmeyen ve **hâlâ süresiz olanlar** (hareketsiz hesap, lobi, öneri, davet, bekleyen arkadaşlık isteği) Aşama 6 kapsamında ele alınmıştır (bkz. "Süresiz kalan veriler" belgesi ve bu tablonun güncel hâli).

## 3. Özel incelenen süreler
* **7 gün** (sessions/outbox/silinmiş bildirim/yedek): kısa, ölçülü. Yedek 14→7 azaltıldı: Render otomatik anlık görüntüsü zaten ≥7 gün tutulur; elle yedeğin daha uzun tutulması için gerekçe yok.
* **30/60/90 gün** (bildirim, silinmiş hesap DM, medya, denetim gerekçesi): amaçlarıyla orantılı; 90 günlük DM/medya süresi **kısaltılabilir** ama ürün etkisi nedeniyle otomatik değiştirilmedi.
* **180/365/730 gün** (rapor/kanıt/mesaj): bu sürelerin **hiçbiri KVKK'da bir gün sayısı olarak öngörülmemiştir**. 730 gün (rapor kaydı, hareketsiz sohbet) ve 365 gün (kanıt metni, mesaj) için somut hukuki gerekçe belgelenmemiştir → **hukuki karar noktası**.
  Otomatik **uzatma yapılmamıştır**; azaltma yapılırsa rapor/kanıt sistemi (testleri kilitli) ile birlikte gözden geçirilmelidir.
* **3 takvim yılı** (yaşam döngüsü logları): silme kayıtları için Yönetmelik asgari süresine dayanır (teyit); bir **üst** süre değil **asgari** süredir; kayıtlar kişisel veri içermez.

## 4. Bu çalışmada yapılan teknik değişiklikler
1. Elle yedek saklaması 14 → **7 gün** (gerekçe yukarıda).
2. Tüm periyodik temizlikler için **kişisel veri içermeyen** `data_lifecycle_log` eklendi (olay + gün + sayaç; ≥3 takvim yılı sonra silinir).
3. Süre içeren belgeler ve gizlilik politikası güncellendi.

## 5. Hukuki karar noktaları (özet)
Mesaj/medya/hareketsiz sohbet sürelerinin dayanağı; rapor/kanıt/denetim sürelerinin dayanağı; 5651 kapsamında yer sağlayıcı sıfatı ve trafik bilgisi saklama; VERBİS; Yönetmelikteki 3 yıllık kayıt ve 6 aylık periyodik imha yükümlülüklerinin Sauran'a uygulanışı;
çocuk hesabı verisi; yedek/sağlayıcı süreleri.

## Kaynaklar (Eylül 2026'da okunanlar)
* KVKK Kurumu — [Yurt Dışına Aktarım](https://www.kvkk.gov.tr/Icerik/2053/Yurtdisina-Aktarim), [Silme/Yok Etme/Anonim Hale Getirme](https://www.kvkk.gov.tr/Icerik/2038/kisisel-verilerin-silinmesi-yok-edilmesi-veya-anonim-hale-getirilmesi), [Yönetmelik](https://www.kvkk.gov.tr/Icerik/5441/KISISEL-VERILERIN-SILINMESI-YOK-EDILMESI-VEYA-ANONIM-HALE-GETIRILMESI-HAKKINDA-YONETMELIK).
* 5651 sayılı Kanun m. 5 (konsolide metin: mevzuat/lexpera) ve 7499 sayılı Kanunla KVKK m. 6 ve m. 9 değişiklikleri (1 Haziran 2024).
