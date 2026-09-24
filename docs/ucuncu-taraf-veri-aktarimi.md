# Üçüncü taraf servisler, veri akışları ve yurt dışı aktarım (güncel)

> **Bu belge hukuki görüş ya da uygunluk beyanı DEĞİLDİR.** Koddan ve sağlayıcıların herkese açık belgelerinden **doğrulanabilenleri**, **doğrulanamayanları** ve **hukuki karar gerektirenleri** ayırır.
> Sağlayıcı bilgileri belge tarihinde (Eylül 2026) ilgili resmî sayfalardan okunmuştur; sağlayıcı koşulları değişebilir ve **yayın öncesinde yeniden teyit edilmelidir**.
> Hiçbir sözleşme imzalanmamış, Kurum'a hiçbir bildirim yapılmamıştır.

## 0. Kodda taranan dış bağımlılıklar

* **Sunucu bağımlılıkları** (`server/package.json`): `better-sqlite3` (yerel), `express`, `socket.io`, `cors`, `dotenv` (yerel), **`firebase-admin`** (FCM), **`nodemailer`** (SMTP), **`web-push`** (tarayıcı push).
* **İstemci:** harici script/yazı tipi/CDN/analitik **yoktur** (`daily-js@0.92.2` kendi sunucumuzdan sunulur, `client/vendor/`). Ödeme, reklam, analitik, sosyal eklenti kodu **bulunmadı**.
* **Mobil kabuk** (`mobile/`, Capacitor): `@capacitor/push-notifications` (FCM istemcisi). Uygulama `https://sauran.onrender.com` adresini WebView'da açar; `google-services.json` depoda yoktur (`.gitignore`).
* **Sunucunun dış çağrıları:** `api.daily.co`, FCM (firebase-admin), tarayıcı push uç noktaları (web-push), `smtp.zoho.com:465`. Başka dış çağrı yoktur.

## 1. Sağlayıcı bazında gerçek veri akışı

Kısaltmalar: **Doğrulandı** = kod veya sağlayıcının resmî sayfası; **Teyit edilmeli** = elde doğrulanabilir kaynak yok.

### 1.1 Firebase Cloud Messaging (Google)
| Konu | Durum |
|---|---|
| Ne gidiyor | Cihaz kayıt anahtarı (FCM token), başlık `Sauran`, türe göre **sabit genel metin**, `data.type`, Android `tag = type`. Mesaj içeriği, gönderen adı, lobi adı, kullanıcı/sohbet numarası, URL **yok** (kod + `fcm_suite`). **Doğrulandı** |
| Ne zaman | Olay bazlı: kullanıcı çevrimdışı/görünmezken DM, lobi mesajı, arama, arkadaşlık isteği/kabulü, lobi daveti, yönetim görevi bildirimi (`dispatchWebPush`). **Doğrulandı** |
| Neden / API | Uygulama kapalıyken bildirim; `firebase-admin` `sendEachForMulticast`, `android.ttl = 1 saat`. **Doğrulandı** |
| Sağlayıcıda tutulma | Firebase, "installation ID"leri ilgili API çağrısıyla silinene kadar tutar; silme sonrası canlı ve yedek sistemlerden **180 gün içinde** kaldırır (Firebase gizlilik sayfası). Teslim edilemeyen ileti bekletmesi: kodda TTL 1 saat verilir; sağlayıcı tarafı davranışı **teyit edilmeli**. |
| Ülke/bölge | Firebase hizmetlerinin çoğu **küresel Google altyapısında** çalışır; belirli bir ülke koddan/sayfadan belirlenemez. **Teyit edilmeli** (tek bir ülke varsaymıyoruz). |
| Alt işleyen / DPA | Firebase Data Processing and Security Terms (bazı hizmetlerde Google Cloud DPA). Google veri işleyen, Sauran veri sorumlusu rolündedir. Sözleşmenin Sauran hesabı için **kabul edildiği/edilmediği doğrulanmalı**. |
| Aktarım mekanizması (sağlayıcı beyanı) | AB-ABD / İsviçre-ABD Veri Gizliliği Çerçevesi (Türkiye için geçerli bir mekanizma DEĞİLDİR; bkz. §3). |
| Teknik minimizasyon | Yük zaten minimum. Token kullanıcı silinince/çıkışta/geçersizleşince silinir. **Ek azaltma gerekmedi.** |

### 1.2 Web Push (tarayıcı üreticisinin push hizmeti)
| Konu | Durum |
|---|---|
| Ne gidiyor | Abonelik uç noktası (tarayıcının kendi push hizmetinin adresi), **Web Push standardıyla şifrelenmiş** genel yük (başlık `Sauran`, sabit metin, `type`, `tag = type`), TTL 1 saat. **Doğrulandı** (kod + `fcm_suite`) |
| Sağlayıcılar | Chrome/Edge: Google/Microsoft push hizmeti; Firefox: Mozilla; Safari/iOS PWA: Apple. Hangi hizmetin kullanıldığı **kullanıcının tarayıcısına bağlıdır**; Sauran seçemez. |
| Ülke/saklama/DPA | Sağlayıcılar Sauran ile **sözleşmeli işleyen değildir**; tarayıcı üreticisinin hizmet koşulları geçerlidir. Konum ve saklama **teyit edilmeli**. |
| Teknik minimizasyon | Yük zaten minimum; şifreli; kullanıcı/mesaj bilgisi yok. |

### 1.3 Daily.co (sesli/görüntülü altyapı)
| Konu | Durum |
|---|---|
| Ne gidiyor | Oda adı (`sauran-hub-<no>`, `sauran-vr-<no>`, `sauran-dm-<no>-<no>`), giriş belirteci (4 saat): **`user_name` sabit `Sauran`**, lobi odalarında yalnızca sayısal `user_id`; **canlı ses/ekran akışı** (WebRTC). Kullanıcı adı **artık gitmez** (bu çalışmada lobi odaları için de kaldırıldı). **Doğrulandı** (kod + `thirdparty_suite`; gerçek Daily ile canlı test yapılamadı) |
| Neden / API | Sesli odalar; `POST /rooms`, `/meeting-tokens`, `DELETE /rooms` (temizlik kuyruğu). Olay bazlı (odaya katılım). |
| Sağlayıcıda tutulma | Daily DPA'ya göre kişisel veri, hizmeti sunmak için gerekli olduğu sürece tutulur; çağrı telemetrisi yapılandırılan sürede silinir; sonlanınca müşteri seçimine göre iade/silme. Sauran'ın Daily hesabındaki **retention ayarı** ve ses/kayıt saklama davranışı **teyit edilmeli** (uygulama ses kaydı almaz). |
| Ülke/bölge | Daily DPA: **birincil işleme Amerika Birleşik Devletleri**, AWS ve Oracle Cloud üzerinde. Alt işleyen listesi `daily.co/legal/sub-processors` (10 gün önceden bildirim). Sauran hesabının bölgesi **teyit edilmeli**. |
| DPA / mekanizma | Daily DPA mevcut (1 Mayıs 2025 sürümü): Daily veri işleyen; AB SCC (Modül 1-3), UK eki, Veri Gizliliği Çerçevesi. **Türkiye'ye özgü** bir mekanizma DPA'da yoktur (bkz. §3). |

### 1.4 Zoho Mail (SMTP)
| Konu | Durum |
|---|---|
| Ne gidiyor | Alıcı e-posta adresi ve gövde: doğrulama kodu, şifre sıfırlama kodu, yönetim görevi bildirimi (kullanıcıya, adıyla), ekip bildirimleri (yeni rapor: yalnızca rapor no/kategori/öncelik/panel bağlantısı; görev kabul/ret: **yalnızca hesap numarası**, kullanıcı adı **bu çalışmada kaldırıldı**), "hesabın zaten var" bilgisi (kod yok). **Doğrulandı** (kod) |
| Ne zaman / API | Olay bazlı, `nodemailer` → `smtp.zoho.com:465` (SSL). |
| Sağlayıcıda tutulma | E-postalar gönderici posta kutusunda (`destek@sauran.online`) ve alıcı sağlayıcısında kalır; uygulama içinde içerik saklanmaz. Zoho saklama süresi **teyit edilmeli**. |
| Ülke/bölge | Zoho veri merkezi **hesaba göre** değişir (Zoho: sunucu bilgisi hesap ayarlarında verilir); `smtp.zoho.com` ana bilgisayar adı tek başına veri merkezini kanıtlamaz. **Sauran'ın Zoho hesabının veri merkezi teyit edilmeli.** |
| DPA | Zoho, DPA talebi için hesap yöneticisinin `legal@zohocorp.com` adresine, **hangi veri merkezine kayıtlı olduğunu belirterek** başvurmasını ister; DPA model sözleşme maddelerine dayanır. Sauran için **imzalanıp imzalanmadığı doğrulanmalı**. |
| Teknik minimizasyon | Rapor e-postası minimum; görev kabul/ret e-postasından kullanıcı adı çıkarıldı; konu satırında ad yok; hata günlüklerine alıcı adresi yazılmaz. |

### 1.5 Render (barındırma)
| Konu | Durum |
|---|---|
| Ne gidiyor | Tüm uygulama: HTTP istekleri (IP, UA, yol/sorgu), veritabanı dosyası, sunucu diski, konsol günlükleri. **Sürekli.** |
| Ülke/bölge | Render bölgeleri: Oregon, Ohio, Virginia (ABD), Frankfurt (Almanya), Singapur; bölge servis oluşturulurken seçilir ve **sonradan değiştirilemez**. Sauran'ın bölgesi **Render panelinden teyit edilmeli** (koddan bilinemez). |
| Disk yedeği | Render otomatik günlük disk anlık görüntüsü alır, **en az 7 gün** erişilebilir tutar, diskler ve anlık görüntüler **bekleme durumunda şifrelidir** (Render dokümantasyonu). Servis/disk silinince anlık görüntülerin akıbeti dokümanda belirtilmemiştir → **Render'dan teyit edilmeli**. |
| DPA / mekanizma | Render DPA ve alt işleyen listesi (`render.com/dpa`, `render.com/trust`) yayınlanmış; Render AB-ABD Veri Gizliliği Çerçevesi sertifikalıdır (sağlayıcı beyanı). Sauran için DPA'nın kabulü **doğrulanmalı**. |
| Günlükler | Render günlük saklama süresi **teyit edilmeli**. Sauran uygulaması günlüğe kullanıcı adı/e-posta/IP **yazmaz**; **bu çalışmada** bildirim tıklama URL'sinden kullanıcı adı (`?name=`) da kaldırıldı (erişim günlüğüne girebilirdi). |

### 1.6 Diğer
* **Google Play Hizmetleri / Android WebView / Apple-Google-Mozilla push:** kullanıcının cihazı ve tarayıcısı üzerinden çalışır; Sauran'ın sözleşmeli işleyeni değildir.
* **GitHub (kaynak depo):** yalnızca kod; kullanıcı verisi yok.
* **npm:** yalnızca geliştirme/dağıtım sırasında paket indirme; çalışma anında kullanıcı verisi göndermez.

## 2. Roller (veri sorumlusu / veri işleyen)
Sauran'ı işleten taraf **veri sorumlusu**dur. Firebase, Daily, Zoho ve Render, Sauran adına veriyi işlediği ölçüde **veri işleyen** konumundadır (sağlayıcıların DPA'ları bu rolü tanımlar). Tarayıcı push hizmetleri ve cihaz üreticisi hizmetleri kullanıcı ile sağlayıcı arasındaki ilişkidir; rol tespiti **hukuki değerlendirme** gerektirir.

## 3. Güncel KVKK yurt dışı aktarım rejimi ve Sauran'a etkisi
**Resmî kaynaklar:** 6698 sayılı Kanun m. 9 (7499 sayılı Kanunla değişik; 1 Haziran 2024'te yürürlüğe girdi), Kişisel Verilerin Yurt Dışına Aktarılmasına İlişkin Usul ve Esaslar Hakkında Yönetmelik (Resmî Gazete, 10 Temmuz 2024 — ikincil kaynaklardan; metin teyit edilmeli),
KVKK Kurulu'nun 04.06.2024 tarih ve 2024/959 sayılı kararı (standart sözleşme ve BCR metinleri), KVKK "Yurt Dışına Aktarım" sayfası ve "Kişisel Verilerin Yurt Dışına Aktarılması Rehberi" (Yayınları No: 48).

Kademeli yapı (Kurum sayfasına göre): **(1) yeterlilik kararı**; **(2) uygun güvenceler**; **(3) yalnızca arızi (istisnai) haller**.

1. **Yeterlilik kararı:** Kurum sayfasında (belge tarihinde) *"henüz bir belirleme yapılmamış"* denmektedir. Dolayısıyla **hiçbir ülke/sağlayıcı için "yeterli ülke" dayanağı kullanılamaz** (AB-ABD DPF veya AB SCC'leri Türkiye rejimi için tek başına mekanizma değildir).
2. **Uygun güvenceler** (yeterlilik yoksa): kamu kurumları arası sözleşme (Kurul izni), **bağlayıcı şirket kuralları**, **Kurul'un ilan ettiği standart sözleşme** (bildirim — izin değil), yazılı taahhüt (Kurul izni). Teorik olarak ilgili olanlar:
   * **Standart sözleşme** — Kurum dört tip yayımlamıştır: veri sorumlusu→veri sorumlusu, veri sorumlusu→veri işleyen, veri işleyen→veri işleyen, veri işleyen→veri sorumlusu. Sauran (veri sorumlusu) → Daily/Google/Zoho/Render (veri işleyen) ilişkisi için **veri sorumlusu→veri işleyen** tipi teorik olarak ilgilidir; taraflar Sauran'ı işleten tüzel/gerçek kişi ile ilgili sağlayıcı olur. İkincil kaynaklara göre sözleşme imzalandıktan sonra **5 iş günü içinde Kurum'a bildirim** gerekir (bildirimi yükümlü taraf ve yöntem **Yönetmelik ve Kurum duyurusundan teyit edilmeli**).
   * **BCR:** yalnızca aynı ekonomik faaliyet grubu içi aktarım için; Sauran için uygulanabilir değildir.
   * **Taahhüt:** Kurul izni gerektirir; standart sözleşme mümkün olduğu için genellikle ikincil.
3. **Arızi haller** (açık rıza, sözleşmenin ifası vb.): Kurum, bunların **arızi, sürekli olmayan** aktarımlar için olduğunu belirtir. Sauran'ın Daily/Zoho/Render/FCM kullanımı **sürekli/olağan** akışlardır; bu istisnalara dayanmak hukuken riskli olabilir → **hukuki karar noktası**.

**Sonuç (teknik + hukuki):** Sağlayıcıların işleme yeri koddan doğrulanamadığından **yurt dışı aktarım varsayılmalıdır** (Daily için sağlayıcı beyanı ABD; Render/Firebase/Zoho için bölge teyit edilmeli). Bu durumda hangi güvencenin kullanılacağı (büyük olasılıkla sağlayıcılarla **standart sözleşme** ve bildirim), aydınlatma metninin buna göre yazılması ve VERBİS gerekliliği **hukuki karar** gerektirir. **Bu çalışmada sözleşme imzalanmadı, Kurum'a bildirim yapılmadı.** Gizlilik politikasında aktarım "kabul edilmelidir; hukuki dayanak henüz doğrulanmış bir değerlendirmeye bağlanmamıştır" şeklinde belirtilmiştir.

## 4. Uygulanan teknik minimizasyonlar (özet)
1. `unpkg.com` kaldırıldı (kütüphane self-host, SRI).
2. Daily'ye **hiçbir odada kullanıcı adı gitmez** (DM ve lobi); yalnızca sayısal `user_id` (lobi) — arayüz adları kendi Socket.io katılımcı listesinden çözer.
3. Yerel bildirim tıklama URL'sinden kullanıcı adı çıkarıldı (Render erişim günlüğüne girmesin).
4. Görev kabul/ret ekip e-postasından kullanıcı adı çıkarıldı; hata günlüklerinde alıcı adresi yok; sunucu günlüklerinde kullanıcı adı yok.
5. FCM/Web Push yükleri yalnızca genel metin + tür (Aşama 9-10); FCM TTL 1 saat, Web Push TTL 1 saat.

## 5. Doğrulanması gerekenler (özet liste)
Render bölgesi ve servis/disk silindikten sonra anlık görüntü akıbeti; Render günlük saklaması; Zoho hesabının veri merkezi ve DPA'nın imzalanıp imzalanmadığı; Daily hesabındaki retention/bölge ayarı ve DPA kabulü; Firebase veri işleme şartlarının kabulü ve
FCM ileti bekletmesi; tarayıcı push hizmetlerinin saklaması; standart sözleşme tipi/tarafları/bildirim usulü (Yönetmelik metninden); VERBİS gerekliliği ve saklama-imha politikası yükümlülüğü.
