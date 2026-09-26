# Ücretlendirme hazırlık belgesi (taslak, karar öncesi)

> **Durum:** Yalnızca hazırlık ve karar belgesidir. Kod, ödeme entegrasyonu ya da fiyat yayını yoktur.
> **Hukuki uyarı:** Bu belgedeki vergi, tüketici hukuku, KVKK, küçük yaş ve platform politikası maddeleri **nihai değildir; yayından önce hukukçu ve muhasebeci tarafından doğrulanmalıdır.** Oranlar ve kurallar sık değişir; alıntılanan rakamlar 2026 Eylül ayı web aramasına dayanır, sözleşme öncesi yazılı teklifle doğrulanmalıdır.

## 1. Ne zaman

Sıralama önerisi:
1. Ses ve Android testleri (gerçek cihaz) tamamlanır.
2. Hukuki inceleme (KVKK, VERBİS, 5651, yurt dışı aktarım) tamamlanır.
3. Kapalı beta gerçek kullanıcıyla çalışır; kullanım verisi ve geri bildirim toplanır.
4. Ancak sonra fiyat ve paket kararı verilir.

Ödeme eklemek geri dönüşü zor bir adımdır (iade, fatura, şikâyet, vergi). Ürün kararsızken eklenmemeli.

## 2. Platform ve ödeme kanalı matrisi

| Kanal | Ödeme yolu | Not |
|---|---|---|
| Web (sauran.online) | Kendi ödeme sağlayıcısı (iyzico, PayTR, Stripe vb.) | En esnek; komisyon yalnızca sağlayıcıya. |
| iPhone/iPad (PWA, Ana Ekrana Ekle) | Web ödemesi | App Store uygulaması yok → Apple uygulama içi satın alma kuralı bu haliyle geçerli olmaz. Yarın App Store'a çıkılırsa **yeniden değerlendirilmeli**. |
| Android APK, siteden indirilen | Web ödemesi | Play dışı dağıtım. Play'e konulursa aşağıdaki satıra geçer. |
| Android, Google Play'de | Play Faturalandırma (dijital özellikler için genellikle zorunlu) | Politika ve bölgeye göre değişir; yayın öncesi Play Console'dan doğrulanmalı. |

**Google Play hizmet bedeli (Eylül 2026 arama sonucu):** Google, hizmet bedeli ile faturalandırma bedelini ayırıyor. Yeni yapı 30 Haziran 2026'da ABD, AEA ve Birleşik Krallık'ta başladı; "dünyanın geri kalanı" için takvim **30 Eylül 2027** olarak duyuruldu. Yani Türkiye için hangi oranın geçerli olduğu Play Console'dan **doğrulanmalı**; bu belgeye kesin oran yazılmadı.
Kaynaklar: [Service fees – Play Console Help](https://support.google.com/googleplay/android-developer/answer/112622?hl=en), [Expanded billing choice and lower fees (Android Developers Blog)](https://android-developers.googleblog.com/2026/06/play-expanded-billing.html).

## 3. Türkiye ödeme sağlayıcıları (ön karşılaştırma)

Web aramasına göre (yazılı teklifle doğrulanmalı): iyzico ve PayTR için **şahıs şirketi veya sermaye şirketi** gerekiyor; komisyonlar işlem türü ve cirona göre kabaca %1–4 aralığında değişiyor; bazı sağlayıcılarda işlem başı sabit ücret ve BSMV ekleniyor; iyzico abonelik ve düzenli tahsilat araçları sunuyor.
Kaynaklar: [PayTR, iyzico ve Shopier karşılaştırması](https://sistemler.io/blog/paytr-iyzico-shopier-karsilastirma), [Türkiye ödeme sistemleri 2026](https://www.zunapro.com/turkey/tr/blog/e-ticarette-odeme-sistemleri-kredi-karti-taksit).

Seçim kriterleri: abonelik (tekrarlayan tahsilat) desteği, webhook güvenliği, 3D Secure, iade API'si, komisyon ve vade, sözleşmenin şirket türü şartı, kart verisinin **bizim sunucumuza hiç gelmemesi** (sağlayıcının barındırılan ödeme sayfası).

## 4. Ürün modeli önerisi

- **Ücretsiz çekirdek:** mesajlaşma, DM, arama, sesli oda. Bunlar kısıtlanmaz.
- **Ücretli katman** yalnızca ek özelliklerle (öneri, betada denenecek):
  - daha büyük dosya limiti,
  - profil ve lobi özelleştirme,
  - daha yüksek sesli oda kapasitesi,
  - ek sticker paketleri.
- Reklam **eklenmemesi** önerilir (küçük yaş ve KVKK riski).
- Fiyat kararı beta verisinden sonra; bu belgede fiyat yok.

## 5. Küçük yaş (18 yaş altı) politikası

Sistemde 18 yaş altı hesap tanımı var. Öneri: **ödeme yalnızca 18 yaş üstü hesaplarda açılır**, 18 yaş altına ücretli özellik satılmaz veya ebeveyn onaylı ayrı bir akış tasarlanır. Bu kararın hukuki dayanağı **hukukçu tarafından doğrulanmalıdır** (reşit olmayanların sözleşme ehliyeti, ebeveyn onayı).

## 6. Hukuki ve vergi kontrol listesi (hukukçu/muhasebeci ile)

- [ ] Gelir elde etme biçimi: şahıs mı şirket mi; vergi mükellefiyeti ve e-fatura/e-arşiv yükümlülüğü.
- [ ] Mesafeli satış sözleşmesi, ön bilgilendirme formu, cayma hakkı (dijital içerik/hizmet istisnaları).
- [ ] Abonelik yenileme, iptal ve iade koşulları; iptalin uygulamadan kolayca yapılabilmesi.
- [ ] KVKK: ödeme sağlayıcısı veri sorumlusu/işleyen ilişkisi, aydınlatma metni güncellemesi, yurt dışı aktarım (Stripe vb. kullanılırsa).
- [ ] Gizlilik politikası ve kullanım şartlarına ödeme maddeleri.
- [ ] Vergi ve komisyon dahil net gelir hesabı; kur farkı (yabancı para birimi kullanılırsa).
- [ ] 6563 sayılı Kanun ve ilgili yönetmelikler kapsamında bilgilendirme yükümlülükleri (hukukçu doğrulamalı).
- [ ] Google Play politikaları (Play'e çıkılırsa) ve Apple kuralları (App Store'a çıkılırsa).

## 7. Teknik iş kırılımı (ileride; şu an yapılmaz)

1. Ödeme sağlayıcısı seçimi ve test hesabı.
2. Sunucuda `subscriptions`/`entitlements` modeli: kullanıcı, plan, durum, dönem sonu (yeni tablo → migration + yedek).
3. Barındırılan ödeme sayfası + **imzalı webhook** (tek doğruluk kaynağı sağlayıcı); webhook doğrulama, tekrar (idempotency), sıra dışı olay.
4. Özellik kapıları: sunucu tarafında yetki kontrolü (istemciye güvenilmez).
5. İptal, iade, ödeme başarısız (dunning), süre bitimi davranışı.
6. Fatura/makbuz e-postası (mevcut e-posta altyapısı SMTP anahtarı gerektirir).
7. Yönetici panelinde salt okunur abonelik görünümü; **kart verisi hiçbir yerde saklanmaz.**
8. Test: sağlayıcı sandbox, iade, çift tahsilat, webhook kaybı, yetkisiz özellik erişimi.

## 8. Riskler

- Erken ücretlendirme: ürün kararsızken iade ve şikâyet yükü.
- Küçük yaş ve tüketici hukuku hataları.
- Play/App Store politika değişiklikleri.
- Tek geliştirici için destek ve iade operasyonu yükü.
- Ödeme hatasında kullanıcıyı yanlış "ücretsiz" duruma düşürmek (özellik kapısı hataları).

## 9. Karar noktaları (sahibinden)

1. Şirket/şahıs durumu ve hangi ödeme sağlayıcısı?
2. Play'e çıkılacak mı, yoksa yalnızca siteden APK mı?
3. Hangi özellikler ücretli olacak, hangileri kesin ücretsiz?
4. 18 yaş altı için ücretli özellik hiç yok mu?
5. Aylık/yıllık fiyat aralığı (betadan sonra).

## 10. Önerilen sonraki adımlar

1. Bu belgeyi gözden geçir; karar noktalarına yanıt ver.
2. Muhasebeci ve hukukçuyla 6. bölümü görüş.
3. Betada "hangi özellik için ödemeye razısın" sorusunu kullanıcılara sor.
4. Karar sonrası ayrı bir teknik tasarım belgesi hazırla (bu belge kod içermez).

## 11. Verilen kararlar ve açık kalanlar (26 Eylül 2026 görüşmesi)

| Konu | Karar / durum |
|---|---|
| Yasal yapı (şahıs / sermaye şirketi) | **Henüz yok, önce karar verilecek.** Ödeme sağlayıcısı seçimi ve ödeme kodu bu karara bağlı; **şimdilik ertelendi.** |
| Play Store ödeme yolu | **Emin değil.** Play Faturalandırma zorunluluğu ve Türkiye komisyonu Play Console'dan doğrulanacak; Play başvurusu sırasında netleşir. |
| Ücretli özellik tipleri | **Büyük dosya limiti, profil ve lobi özelleştirme, ek sticker paketleri.** Sesli oda kapasitesi ücretli katmana **alınmadı**; sesli iletişim ücretsiz kalır. |
| 18 yaş altı | **Emin değil.** Karar hukukçuya danışılana kadar varsayılan: 18 yaş altı hesaplara ücretli özellik **satılmaz**. |
| Fiyat | Betadan sonra. |

**Bir sonraki adımlar (kod gerekmez):**
1. Muhasebeci ile yasal yapıyı (şahıs mı şirket mi) ve e-fatura yükümlülüğünü görüş (6. bölüm listesi).
2. Hukukçuya küçük yaş politikasını (varsayılan: satış yok) ve mesafeli satış/cayma metinlerini sor.
3. Betada kullanıcılara "hangi ücretli özellik için ödemeye razısın" sorusunu sor (yalnızca üç özellik tipi üzerinden).
4. Yasal yapı belli olunca ödeme sağlayıcısını seç, ardından ayrı bir teknik tasarım belgesi hazırla.

> **Hukuki uyarı:** Bu tablo yalnızca ürün kararlarını kaydeder; hiçbir hukuki, vergi ya da platform politikası maddesi doğrulanmış değildir.
