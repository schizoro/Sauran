# Sauran — teknik veri envanteri ve yaşam döngüsü matrisi (Aşama 20)

> **Bu belge hukuki uyumluluk garantisi DEĞİLDİR.** Koddaki mevcut teknik davranışı (tablolar, süreler, silme/dışa aktarım/erişim) tek yerde toplar. Tüm süreler **teknik varsayılandır**;
> KVKK Kurumu ya da başka bir makamca belirlenmiş süreler değildir. "Hukuki doğrulama" sütunu, kodun tek başına cevaplayamayacağı noktaları işaretler.
> Sağlayıcı konumu/saklaması **koddan bilinemez**; "doğrulanmalı" olarak bırakılmıştır.

İlgili ayrıntı belgeleri: [mesaj saklama](mesaj-saklama-politikasi.md), [rapor kanıtı](rapor-kaniti-saklama-politikasi.md), [silinmiş hesap DM](silinmis-hesap-dm-saklama-politikasi.md),
[bildirim/outbox](bildirim-outbox-saklama-politikasi.md), [auth](auth-guvenlik-notlari.md), [üçüncü taraf](ucuncu-taraf-veri-aktarimi.md), [yedekler](yedekleme-ve-dis-kopyalar.md), [çocuk kullanıcılar](cocuk-kullanicilar-ve-hassas-veri.md).

Kısaltmalar: **HS** = hesap silinince, **EX** = kullanıcı dışa aktarımına (`GET /api/account/export`) girer mi, **3T** = üçüncü tarafa gider mi, **YD** = yurt dışı olasılığı,
**YK** = yedekte kalabilir mi, **HD** = hukuki doğrulama gerekir mi. Tüm tablolar canlı DB'de (`sauran.db`, Render diski) durur; DB dosyası **YD: olabilir (Render, doğrulanmalı)** ve **YK: evet** olduğundan bu iki sütun aksi belirtilmedikçe tüm satırlar için geçerlidir.

## 1. Veri kaynağı matrisi

### Hesap ve kimlik

| Veri | Kimle ilgili / içerik | Neden | Teknik saklama | HS | EX | Erişim | 3T | İmha | HD |
|---|---|---|---|---|---|---|---|---|---|
| **users** | Kullanıcı adı, e-posta, parola özeti+tuz (scrypt), biyografi, durum, profil/kapak görseli, `avatar_visibility`, `minor_until`, şartlar onay zamanı, rol, askı bilgisi; `birth_date` sütunu ESKİ şemadan kalır ve her zaman NULL | Hesap/hizmet | Hesap silinene kadar; **730 gün hiç etkinlik yoksa** 30 gün önceden e-posta uyarısı → silme (teknik varsayılan; yönetim rolleri/askıdakiler/etkin üyeli lobi sahipleri hariç; bkz. `suresiz-veriler.md`) | Satır silinir; bağlantılar temizlenir (aşağıdaki HS listesi) | Evet (parola özeti/tuz hariç; `age_group`/`is_minor`) | Kullanıcı kendisi; moderatör/yönetici sınırlı görünüm (tam doğum tarihi yok, yaş grubu var); görseller `avatar_visibility`'ye göre | E-posta gönderimleri Zoho'ya (bkz. e-posta) | `DELETE` + `secure_delete` | **Evet**: hareketsiz hesap süresi, hukuki dayanak |
| **sessions** | Oturum belirteci özeti (düz belirteç yok), tarayıcı UA, zaman | Oturum | 7 gün; süresi dolan 10 dk'da bir silinir; çıkış/şifre değişimi/silmede silinir | Silinir | Evet (liste; belirteç yok) | Kullanıcı (kendi listesi); sunucu | Hayır | `DELETE` | Hayır |
| **pending_verifications** | Kullanıcı adı, e-posta, parola özeti, kod özeti, `minor_until` (yalnızca 18 altı), onay | E-posta doğrulama | 10 dakika, 5 deneme; 10 dk'da bir temizlenir | (hesap oluşmadan) süresi dolunca silinir | Hayır | Sunucu | Kod e-postası Zoho'ya | `DELETE` | Hayır |
| **password_resets** | Kod özeti, deneme sayısı | Şifre sıfırlama | 10 dakika, 5 deneme; temizlenir | Silinir | Hayır | Sunucu | Kod e-postası Zoho'ya | `DELETE` | Hayır |

### Mesajlaşma ve lobi

| Veri | Kimle ilgili / içerik | Neden | Teknik saklama | HS | EX | Erişim | 3T | İmha | HD |
|---|---|---|---|---|---|---|---|---|---|
| **messages** (lobi + DM; medya `payload` içinde) | Gönderen, içerik, medya, oda, yanıt/iletme/sabitleme bağlantıları | Sohbet | Medya 90 g; metin 365 g (sohbetin en yeni 200 mesajı hariç, sabitler hariç); 730 g hareketsiz sohbet; kendi silme = içeriksiz mezar taşı; silinmiş hesap DM'i 90 g | Kendi lobi mesajları silinir; DM'lerde kendi mesajları mezar taşı, karşı tarafınkiler 90 gün salt okunur korunur; iletilmiş kopyalar içeriksiz | Yalnızca kullanıcının **gönderdikleri** (ek dosyalar dahil, süresi dolmamış) | Lobi üyeleri / DM tarafları; moderasyon yalnızca rapor kanıtı üzerinden | **Hayır** (bildirimde içerik yok) | `DELETE`/`UPDATE` + `secure_delete`, saatte bir temizlik | **Evet** (süreler, özel nitelikli içerik) |
| **message_reactions**, **hub_poll_votes** | Kim hangi mesaja tepki/oy verdi | Etkileşim | Mesajla birlikte; mesaj silinince/süresi dolunca silinir | Kullanıcının tepki/oyları silinir (cascade) | Evet (kendi tepki/oyları) | Lobi/DM tarafları | Hayır | `DELETE` (cascade) | Hayır |
| **hubs, hub_members, hub_roles** | Lobi adı/görseli/açıklaması, üyelik, roller | Topluluk | Lobi silinene kadar | Sahibi olunan lobiler (mesajlar, üyelikler, davetler, banlar, sesli odalar) tamamen silinir; üyelik silinir | Evet (üyelikler + sahibi olunan lobiler) | Lobi üyeleri | Sesli odalar için Daily | `DELETE` | Evet (hareketsiz lobi) |
| **hub_invites, hub_bans** | Davet kodu + oluşturan; ban + banlayan | Lobi yönetimi | Lobi silinene kadar | Kullanıcının davetleri silinir; banlayan bağlantısı lobi sahibine devredilir | Hayır | Lobi yöneticileri | Hayır | `DELETE`/`UPDATE` | Hayır |
| **hub_voice_rooms** | Oda adı, Daily oda adı, oluşturan | Sesli oda | Oda silinene kadar | Oluşturan lobi sahibine devredilir (yoksa lobi silinir) | Hayır | Lobi üyeleri | **Daily** (oda adı) | `DELETE` + Daily silme kuyruğu | Hayır |
| **daily_room_cleanup** | Silinecek Daily oda adları (sayısal kimlik), deneme/hata | Daily odalarının silinmesi | Başarılı silmeye kadar; deneme başına geri çekilme (en çok 6 saat); Daily anahtarı yoksa bekler | Hesap silinince DM çağrı odaları eklenir | Hayır | Sunucu | Daily API | Başarılı silmede satır silinir | Hayır |

### Sosyal ve tercihler

| Veri | İçerik | Neden | Teknik saklama | HS | EX | Erişim | 3T | İmha | HD |
|---|---|---|---|---|---|---|---|---|---|
| **friendships**, **blocked_users** | İki kullanıcı ilişkisi, engellemeler | Arkadaşlık/DM izni/güvenlik | Kaldırılana/hesap silinene kadar | Silinir (cascade) | Evet | İlgili kullanıcılar | Hayır | `DELETE` | Hayır |
| **notification_preferences** | Bildirim tercihleri | Tercihler | Hesap silinene kadar | Silinir (cascade) | Evet | Kullanıcı | Hayır | `DELETE` | Hayır |
| **feedback**, **feedback_votes** | Kullanıcı önerisi (başlık/metin), oylar | Ürün geri bildirimi | Hesap silinene kadar (kullanıcıya ait öneri/oylar silinir) | Silinir (cascade) | Evet | Giriş yapmış kullanıcılar (öneri panosu) | Hayır | `DELETE` | Evet (süresiz öneri saklaması) |

### Bildirim ve cihaz

| Veri | İçerik | Neden | Teknik saklama | HS | EX | Erişim | 3T | İmha | HD |
|---|---|---|---|---|---|---|---|---|---|
| **notifications** | Uygulama içi bildirimler (tür, gönderen adı/kimliği) | Uygulama içi bildirim | 7 g (yanıtlanmış/okunmuş), 30 g (görülmüş), 60 g (okunmamış), 90 g (yanıt bekleyen istek/davet) | Kullanıcının bildirimleri silinir; başkalarındakilerde bu hesaba ait ad/kimlik silinir/anonimleştirilir | Hayır (başkalarının adı içerebilir) | Kullanıcı | Hayır | `DELETE` saatte bir | Hayır |
| **role_notice_email_outbox** | Görev e-postası kuyruğu (tür, rol, sürüm; **içerik/alıcı adresi saklanmaz**) | E-posta güvenilirliği | 7 gün | Silinir (cascade) | Hayır | Sunucu | E-posta Zoho'ya | `DELETE` | Hayır |
| **fcm_tokens** | Android cihaz anahtarı, UA | Android bildirimi | Geçersiz olana / hesap silinene / çıkışta kaldırılana kadar; kullanıcı başına en çok 10 | Silinir (cascade) | Evet (cihaz listesi; anahtar yok) | Sunucu | **Google (FCM)**: anahtar + genel metin | `DELETE` | Google tarafı: **doğrulanmalı** |
| **push_subscriptions** | Web Push uç noktası + anahtarlar, UA | Tarayıcı bildirimi | 404/410 olana / hesap silinene kadar; en çok 10 | Silinir (cascade) | Evet (uç nokta/anahtar yok) | Sunucu | **Tarayıcı üreticisinin push hizmeti**: şifreli genel yük, TTL 1 saat | `DELETE` | Push hizmeti tarafı: **doğrulanmalı** |

### Rapor ve moderasyon

| Veri | İçerik | Neden | Teknik saklama | HS | EX | Erişim | 3T | İmha | HD |
|---|---|---|---|---|---|---|---|---|---|
| **reports** | Raporlayan, hedef, neden, açıklama (serbest metin), durum | Moderasyon | `retention_until`: açık 365 g / reddedilen 90 g / işlem yapılan 730 g (üst sınır 730 g); nedene göre uzatma yok | Raporlayan bağlantısı kopar (`reporter_account_deleted`); rapor kendi süresine kadar kalır | Yalnızca kullanıcının **açtığı** raporlar (kendi bildirimi) | **Yalnızca yetkili moderasyon** (moderatör/yönetici/kurucu) | Rapor bildirim e-postası (yalnızca no/kategori/öncelik/bağlantı) Zoho'ya | `DELETE` süre dolunca | **Evet** (süre, çocuk güvenliği raporları) |
| **report_evidence** | Raporlandığı andaki mesaj metni + metadata (mesajlardan bağımsız kopya) | Sonradan silinen içerikle incelemenin boşa çıkmaması | Açık 180 g / reddedilen 30 g / işlem yapılan 365 g | Gönderen/alıcı bağlantısı kopar (bayrak) | Hayır | Yalnızca yetkili moderasyon | Hayır | `DELETE` (`retention_until`) | **Evet** |
| **report_evidence_media** | Medya (ses/görsel/video/dosya) kopyası | Kanıt | Açık 90 g / reddedilen 7 g / işlem yapılan 180 g (metinden uzun olamaz) | Aynı | Hayır | Yalnızca yetkili moderasyon | Hayır | `DELETE` | **Evet** |
| **evidence_lifecycle_log** | İmha/anonimleştirme olayı, rapor no, sayılar (mesaj/kullanıcı adı/e-posta/IP/medya yok; **rapor no mevcut kayıtlarla eşleştirilebildiği için takma adlı kişisel veri olabilir**) | Silme kaydı (hesap verebilirlik) | En az 3 **takvim yılı**; kanıt/rapor temizliğinden bağımsız | Etkilenmez | Hayır | Sunucu/yetkili | Hayır | Süre dolunca silinir; append-only | **Evet** (süre) |
| **data_lifecycle_log** | Diğer tüm süre/silme temizliklerinin (mesaj, bildirim, oturum/kod, silinmiş hesap DM, denetim, yedek, hesap silme) olay adı + gün + **yalnızca sayaçlar** (kişisel veri/içerik/kimlik YOK) | Silme/imha kaydı (hesap verebilirlik) | En az 3 takvim yılı (evidence_lifecycle_log ile aynı kural); günlük toplanır | Etkilenmez | Hayır | Sunucu/yetkili | Hayır | Süre dolunca silinir | **Evet** (süre) |
| **moderation_actions** | Rapor işlemi (moderatör, eylem, gerekçe — serbest metin) | Moderasyon kaydı | Rapor silinince (cascade) | Moderatör bağlantısı NULL yapılır | Hayır | Yetkili moderasyon | Hayır | Rapor ile | Evet |
| **admin_audit_log** | Yetki işlemi (aktör/hedef no, eylem, kısa gerekçe, rol/durum etiketi) | Yetki kötüye kullanımı denetimi | Gerekçe 90 g; kayıt 365 g | Hesaba bağlantı kaldırılır; iki tarafı silinen kayıt silinir | Hayır | Yalnızca kurucu | Hayır | `UPDATE`/`DELETE` (tetikleyici geçici kaldırılır) | **Evet** |

### İstemci, günlük, e-posta, üçüncü taraf, kopyalar

| Veri | İçerik | Neden | Teknik saklama | HS | EX | Erişim | 3T | İmha | HD |
|---|---|---|---|---|---|---|---|---|---|
| **Çerez `sauran_session`** | Oturum belirteci (HttpOnly, SameSite=Lax, Path=/, üretimde Secure) | Oturum | 7 gün | Silme çerezi gönderilir | — | Tarayıcı | Hayır | Süre/silme çerezi | Çerez bildirimi: **doğrulanmalı** |
| **localStorage** | `sauran_theme`, `sauran_lang`, `sauran_ios_voice_hint_seen`, `sauran_fcm_token` (yalnızca Android kabuğu) | Tercih/ipucu/bildirim anahtarı | Kullanıcı temizleyene kadar (tarayıcıda) | Hesap silinince tarayıcıda kalabilir; FCM anahtarı çıkışta kaldırılır | — | Yalnızca kullanıcının cihazı | FCM anahtarı Google'a | Kullanıcı/tarayıcı | Hayır |
| **Sunucu/güvenlik günlükleri** | Yalnızca konsol; kullanıcı adı/e-posta/IP yazılmaz | İşletme | Render günlük saklaması: **doğrulanmalı** | — | Hayır | Operatör | Render | Render | **Evet** |
| **E-posta** (Zoho) | Doğrulama/sıfırlama kodu, görev bildirimi, rapor bildirimi, "hesabın zaten var" bilgisi | İletişim | Uygulamada içerik saklanmaz; gönderici posta kutusunda ve alıcı sağlayıcısında kalır | — | Hayır | Posta kutusu sahipleri | **Zoho** | Uygulama dışı | **Evet** |
| **Üçüncü taraf yükleri** | FCM/Web Push (genel metin), Daily (oda adı, ad/`user_id`, ses), Zoho (e-posta) | Hizmet | Bkz. üçüncü taraf belgesi | — | — | — | Evet | Sağlayıcı | **Evet** |
| **Yedek/anlık görüntü** | DB kopyaları | Felaket kurtarma | Uygulama yedek almaz; elle asgari yedek 7 g; Render yedeği: **doğrulanmalı** | Yedeklerde kalabilir | — | Operatör | Render | Süre/elle silme | **Evet** |
| **Dışa aktarım dosyaları** | Sunucuda dosya yazılmaz; bellekte üretilip indirilir (`no-store`) | Erişim hakkı | Sunucuda saklanmaz | — | (kendisi) | Kullanıcı | Hayır | — | Hayır |

## 2. Hesap silinince (özet)

Tek transaction'da: rapor bağlantıları koparılır; denetim kayıtlarından bağlantı kaldırılır; sahibi olunan lobiler ve mesajlar silinir; DM'ler (kendi mesajları mezar taşı, karşı taraf 90 gün salt okunur);
mesaj kopyaları içeriksiz; tepki/oy/arkadaşlık/engel/bildirim/tercih/öneri/oturum/cihaz anahtarları silinir; lobilerde oluşturan/banlayan/sabitleyen/moderatör bağlantıları devredilir ya da NULL yapılır; kullanıcı satırı silinir.
Sonrasında: açık soketler kapanır, Daily odaları kuyrukla silinir, cookie silinir. **Kalanlar:** rapor/kanıt (kendi süresince, bağlantısız), yaşam döngüsü logu, yedekler, sağlayıcı kopyaları.
Hesap silme **parola ile yeniden doğrulanır** (Aşama 16).

## 3. Tüm teknik saklama süreleri (tek liste)

| Konu | Süre | Kaynak |
|---|---|---|
| Oturum (cookie + DB) | 7 gün | `SESSION_DURATION` |
| Doğrulama / şifre sıfırlama kodu | 10 dk, 5 deneme | `createVerification`, `requestPasswordReset` |
| Süresi dolmuş oturum/kod temizliği aralığı | 10 dk | `runAuthCleanup` |
| Mesaj medyası (payload) | 90 gün | `MESSAGE_RETENTION.media_days` |
| Mesaj metni (aktif geçmiş dışı) | 365 gün; sohbetin en yeni 200 mesajı korunur | `text_days`, `active_keep` |
| Hareketsiz sohbet | 730 gün | `dormant_days` |
| Silinmiş hesap DM sohbeti | 90 gün (hesap silme anından) | `DELETED_DM_RETENTION_DAYS` |
| Rapor kaydı | 365 (açık) / 90 (reddedilen) / 730 (işlem yapılan) gün; üst sınır 730 | `RETENTION_POLICY.report_record` |
| Rapor kanıtı metni | 180 / 30 / 365 gün | `evidence_text` |
| Rapor kanıtı medyası | 90 / 7 / 180 gün | `evidence_media` |
| Kanıt yaşam döngüsü logu | en az 3 takvim yılı | `lifecycle_log_years` |
| Bildirimler | 7 / 30 / 60 / 90 gün | `NOTIFICATION_RETENTION_DAYS` |
| E-posta outbox | 7 gün | `OUTBOX_RETENTION_DAYS` |
| Denetim kaydı gerekçesi / kaydı | 90 / 365 gün | `AUDIT_REASON_RETENTION_DAYS`, `AUDIT_RETENTION_DAYS` |
| 18 yaş altı `minor_until` | 18. yaş gününe kadar | `purgeAdultBirthDates` |
| Elle alınan yedek | 7 gün | `BACKUP_RETENTION_DAYS` |
| Web Push teslim penceresi | 1 saat (TTL) | `push.js` |
| Daily giriş belirteci | 4 saat | `daily.js` |
| Daily silme kuyruğu yeniden deneme | en çok 6 saat aralık, başarıya kadar | `failDailyRoomCleanup` |
| Hareketsiz **hesap** | 730 gün (+30 gün uyarı) | `INDEFINITE_RETENTION.inactive_account_days` |
| Kullanılmayan **davet kodu** | 180 gün | `invite_idle_days` |
| Yanıtlanmayan **arkadaşlık isteği** | 90 gün | `pending_friend_days` |
| **Öneri** girdisi | 730 gün | `feedback_days` |
| Hareketsiz **lobi** | Süre doldu diye silinmez; sahibinin hesabına bağlı | Aşama 6 kararı |

## 4. Tutarlılık kontrolünde bulunan ve düzeltilen gerçek boşluk

* **Hesap silme bir grup kullanıcı için başarısız olabilirdi:** `hub_voice_rooms.created_by` yabancı anahtarı silme kuralsızdı; başkasının lobisinde sesli oda oluşturmuş bir yönetici hesabını silemezdi
  (transaction geri alınır, "Hesap silinemedi"). Şimdi bu odalar/banlar lobi sahibine devredilir; moderasyon/denetim bağlantıları temizlenir. `lifecycle20_suite` tüm tablolarda silinen numarayı gösteren sütun taraması yapar (0 kalıntı).

## 5. Açık kalan / hukuki karar gerektirenler

1. Hareketsiz lobi için ayrı süre yok (sahibinin hesabına bağlı); hareketsiz hesap/öneri/davet/istek sınırları teknik varsayılandır — süreler için hukuki karar.
2. Özel nitelikli veri içerebilecek serbest metin/medya için içerik türüne özel süre/koruma kararı (kod içerik sınıflandırmaz).
3. Çocuk kullanıcılar ve çocuk güvenliği raporları için özel yükümlülükler ([çocuk belgesi](cocuk-kullanicilar-ve-hassas-veri.md)).
4. Sağlayıcı konumu/saklaması/alt işleyenler ve yurt dışı aktarım dayanağı ([üçüncü taraf belgesi](ucuncu-taraf-veri-aktarimi.md)).
5. Yedek ve sağlayıcı anlık görüntü süreleri ([yedek belgesi](yedekleme-ve-dis-kopyalar.md)).
6. Çerez/yerel depolama bilgilendirme ve rıza gereksinimi (yalnızca zorunlu oturum çerezi + tercih kayıtları kullanılır; analitik/reklam yok).
