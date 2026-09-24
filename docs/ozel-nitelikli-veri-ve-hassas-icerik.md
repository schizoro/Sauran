# Özel nitelikli kişisel veriler ve hassas içerik

> **Hukuki görüş değildir.** Teknik durumu ve hukuki karar noktalarını ayırır. Resmî metinler (KVKK m. 6, Kurul kararları, Kurum rehberleri) yayın öncesinde yeniden okunmalıdır.
> Sauran **içerik analizi, hassas veri sınıflandırıcısı veya yapay zekâ moderasyonu içermez** ve bu çalışmada eklenmemiştir.

## 1. Hukuki çerçeve (özet; resmî kaynaklardan teyit edilmeli)
* **6698 sayılı Kanun m. 6:** ırk, etnik köken, siyasi düşünce, felsefi inanç, din/mezhep/diğer inançlar, kılık kıyafet, dernek/vakıf/sendika üyeliği, **sağlık, cinsel hayat**, ceza mahkûmiyeti ve güvenlik tedbirleri ile **biyometrik ve genetik veriler** özel nitelikli kişisel veridir.
  7499 sayılı Kanunla (1 Haziran 2024) m. 6'daki işleme şartları yeniden düzenlenmiş ve sekiz bent hâlinde genişletilmiştir (ikincil kaynaklara göre; resmî metin `mevzuat.gov.tr`'den okunmalı). İşleyen tarafın **yeterli önlemler** alması gerekir (Kurul'un özel nitelikli veriler için yeterli önlemlere ilişkin kararı — güncel hâli **teyit edilmeli**).
* Sauran'ın bu verileri **amaç edinmeyerek** topladığı, kullanıcıların serbest içerikte kendiliğinden paylaşabildiği bir durum söz konusudur. Platformun bu içeriği "işleyen" sayılıp sayılmadığı, dayanağı ve sorumluluğu **hukuki karardır**.

## 2. Özel nitelikli veri nerede oluşabilir? (kod incelemesi)

| Alan | Örnek | Erişim | Saklama | Teknik durum |
|---|---|---|---|---|
| Sohbet mesajları (metin) | sağlık, din, cinsel hayat beyanı | Sohbet tarafları | 365 gün (aktif geçmiş hariç)/730 gün hareketsiz | Sınıflandırılmaz; bildirim/e-posta/log/audit'e **kopyalanmaz** |
| Medya (ses/görsel/video/dosya) | sağlık belgesi, kimlik, yüz/ses | Sohbet tarafları | **90 gün** | Görsel üstverisi (GPS/EXIF) **çıkarılır** (bu çalışma); ses/video/dosya üstverisi çıkarılmaz |
| Profil metni ("Hakkımda"), durum | din, sağlık | Lobi üyeleri/arkadaşlar (18 yaş altı: yalnızca arkadaşlar) | Hesap silinene kadar | Arayüzde **"hassas bilgi yazma" uyarısı** (bu çalışma) |
| Profil/kapak fotoğrafı | yüz fotoğrafı | `avatar_visibility` ayarına göre | Hesap silinene kadar | Sunucuda görünürlük uygulanır; GPS/EXIF çıkarılır; **yüz tanıma veya biyometrik işleme YAPILMAZ** |
| Ses mesajı / canlı ses | ses (biyometrik potansiyel) | Sohbet tarafları / Daily | Ses mesajı 90 gün; canlı ses saklanmaz | Sauran ses kaydı almaz; Daily'ye kullanıcı adı gitmez |
| Ekran paylaşımı | ekrandaki her şey | Odadaki katılımcılar (Daily) | Saklanmaz | Sauran kaydetmez; Daily tarafı **teyit edilmeli** |
| Rapor açıklaması | mağdur/şüpheli hakkında hassas ayrıntı | **Yalnızca yetkili moderasyon** | Rapor süresi (90–730 gün) | 500 karakter sınırı; e-posta ve bildirimlere **gitmez**; arayüzde uyarı (bu çalışma) |
| Rapor kanıtı (metin/medya) | raporlanan mesajın kopyası | **Yalnızca yetkili moderasyon** | 30–365 gün / medya 7–180 gün | Minimum alan; kullanıcı adı/e-posta/yaş kopyalanmaz |
| Denetim kaydı gerekçesi | yönetici iç notu | Yalnızca kurucu | 90 gün (gerekçe) / 365 gün | e-posta/IP/URL/uzun jeton maskelenir; 200 karakter |
| Bildirimler (FCM/Web Push/e-posta) | — | — | — | Yalnızca genel metin + tür; içerik yok |
| Dışa aktarım | kullanıcının kendi içeriği | Yalnızca kullanıcı | Sunucuda dosya yok | Başkalarından gelen mesaj içeriği **dahil değil** |
| Günlükler | — | Operatör | Render | Kullanıcı adı/e-posta/IP/içerik yazılmaz |

## 3. Bu çalışmada uygulanan teknik minimizasyon
1. **Görsel üstverisi temizliği** (`server/imagemeta.js`): JPEG (EXIF/GPS/cihaz, XMP, IPTC, yorum), PNG (eXIf, tEXt, zTXt, iTXt, tIME), WebP (EXIF, XMP) — piksellere dokunmadan; ICC/JFIF korunur; ayrıştırılamazsa dosya olduğu gibi kalır. Profil/kapak/lobi görseli, lobi ve DM sohbet görselleri yüklenirken; mevcut kayıtlar açılışta bir kez temizlenir. Gerçek tarayıcı JPEG'iyle doğrulandı (görsel hâlâ çözülüyor).
2. Rapor açıklaması ve "Hakkımda" alanlarında **hassas bilgi yazmama** uyarısı; gizlilik politikasında bilgilendirme.
3. Bildirim/e-posta/denetim/günlük/export yollarında özel nitelikli veri **taşınmadığı** testlerle doğrulandı (`fcm_suite`, `thirdparty_suite`, `consistency21_suite`, `auditlog_suite`).
4. Rapor kanıtı/açıklaması erişimi yalnızca yetkili moderasyon ile sınırlı (403 testli).

## 4. Hukuki karar/politika gerektirenler
* Özel nitelikli veri için **işleme şartı** (m. 6 güncel bentleri), **yeterli önlemler**, aydınlatma metninin kapsamı, açık rıza gerekip gerekmediği.
* Serbest içerikte kendiliğinden paylaşılan özel nitelikli verinin platform açısından hukuki niteliği ve silme/itiraz taleplerine yaklaşım.
* Yüz fotoğrafı ve ses kaydının **biyometrik veri** sayılıp sayılmayacağı (yalnızca kimlik doğrulama/tanıma amaçlı teknik işleme hâlinde söz konusu olduğu yönünde yaygın görüş vardır; Sauran böyle işlem yapmaz — **hukuki teyit** gerekir).
* Rapor kanıtlarındaki özel nitelikli içerik için **süre ve erişim** yeterliliği (mevcut süreler teknik varsayılandır).
* Ses/video/dosya üstverisi (ör. dosya adı, belge özellikleri) çıkarılmaz; bu kararın (teknik olarak mümkünse) genişletilmesi ürün kararıdır.
