# Hukuki inceleme kontrol listesi (kapalı beta öncesi)

> **Bu belge hukuki görüş DEĞİLDİR ve uygunluk beyanı içermez.** Yalnızca teknik olarak mevcut olanı gösterir ve bir hukukçunun incelemesi gereken başlıkları listeler. Durum etiketleri: **Teknik olarak mevcut** · **Belgelendirilmiş** · **Hukuki inceleme gerekli**. Resmî kaynaklar: 6698 sayılı KVKK (7499 değişikliğiyle), Kişisel Verilerin Yurt Dışına Aktarılması Yönetmeliği (2024), KVKK Kurumu rehberleri, 5651 sayılı Kanun — güncel metinlerini hukukçu doğrulamalıdır.

| # | Başlık | Teknik durum | Belge/kanıt | Durum |
|---|---|---|---|---|
| 1 | KVKK aydınlatma metni | Gizlilik politikası (TR/EN) uygulama ve sitede yayında; içeriği kodla eşleştirilmiş | `client/gizlilik-politikasi.html`, `docs/final-tutarlilik-denetimi.md` | Teknik olarak mevcut · **Hukuki inceleme gerekli** (metnin aydınlatma yükümlülüğünü karşılayıp karşılamadığı) |
| 2 | İşleme amaçları | Veri envanterinde tablo bazında amaç yazılı | `docs/veri-envanteri-yasam-dongusu.md` | Belgelendirilmiş · İnceleme gerekli |
| 3 | Hukuki sebepler (m.5/m.6) | Sözleşmenin ifası / meşru menfaat / açık rıza eşleştirmesi taslak | `docs/veri-saklama-hukuki-eslestirme.md` | **Hukuki inceleme gerekli** |
| 4 | Saklama süreleri | Tüm süreler "teknik varsayılan"; otomatik temizlik çalışıyor, silme kaydı tutuluyor | `docs/veri-saklama-hukuki-eslestirme.md`, `data_lifecycle_log` | Teknik olarak mevcut · **Hukuki inceleme gerekli** (sürelerin hukuki dayanağı) |
| 5 | Hesap silme | Şifre yeniden doğrulamalı, atomik; DM karşı taraf koruması; yetim kontrolü testli | `delete_suite`, `dm_deletion_suite` | Teknik olarak mevcut |
| 6 | Veri dışa aktarma | `GET /api/account/export` (kendi verisi; başkalarının verisi yok; doğum tarihi yok) | `kvkk_suite` | Teknik olarak mevcut |
| 7 | Çocuk kullanıcılar | 13 yaş alt sınırı (kodda `MIN_SIGNUP_AGE`); 18 yaş altı görünürlük kısıtları | `docs/cocuk-kullanicilar-ve-hassas-veri.md` | Teknik olarak mevcut · **Hukuki inceleme gerekli** (yaş sınırı, ebeveyn onayı, çocuk verisi yükümlülükleri) |
| 8 | Raporlama ve moderasyon | Kanıt saklama süreli, erişim rol bazlı, denetim kaydı | `docs/rapor-kaniti-saklama-politikasi.md` | Teknik olarak mevcut · İnceleme gerekli |
| 9 | Beta davet kodları / geri bildirim | Kod SHA-256 hash'li; geri bildirim 365 gün, hesap silinince silinir, dışa aktarımda yer alır | `docs/veri-envanteri-yasam-dongusu.md` | Teknik olarak mevcut · İnceleme gerekli |
| 10 | Yurt dışı hizmet sağlayıcılar | Aşağıda | — | **Hukuki inceleme gerekli** |
| 11 | VERBİS | Koddan çıkarılamaz (çalışan sayısı, mali bilanço, ana faaliyet, özel nitelikli veri işleme faaliyetine bağlı) | — | **Veri sorumlusu + hukukçu değerlendirmeli** |
| 12 | 5651 yükümlülükleri | Teknik günlükler sınırlı (konsol; kullanıcı adı/e-posta/IP yazılmaz). Yer/erişim sağlayıcı statüsü koddan belirlenemez | — | **Hukukçu değerlendirmeli** (uygulanıp uygulanmadığı belirtilmemiştir) |
| 13 | Kullanım Şartları / Topluluk Kuralları / Çocuk Güvenliği | Sitede yayında | `client/kullanim-sartlari.html`, `topluluk-kurallari.html`, `cocuk-guvenligi.html` | Teknik olarak mevcut · İnceleme gerekli |
| 14 | Veri sorumlusu / işleyen ilişkisi | Sağlayıcılarla imzalı sözleşme YOK (imzalanmadı); işleyen sıfatları belirlenmedi | `docs/ucuncu-taraf-veri-aktarimi.md` | **Hukuki inceleme gerekli** |
| 15 | Yedekler | Günlük otomatik asgari yedek (7 gün/7 adet), isteğe bağlı şifreli off-site (şu an yapılandırılmamış); Render anlık görüntüleri (≥7 gün) | `docs/yedekleme-ve-dis-kopyalar.md` | Belgelendirilmiş · İnceleme gerekli |

## Yurt dışı / üçüncü taraf hizmetler
| Sağlayıcı | Ne gider | Bölge/sözleşme durumu | Durum |
|---|---|---|---|
| **Render** (barındırma) | Tüm uygulama verisi (veritabanı diski, günlükler) | Servis bölgesi seçime bağlı (ABD/Almanya/Singapur); DPA imzalanmadı; anlık görüntü süresi üst sınırı teyit edilmedi | İnceleme gerekli |
| **Zoho** (e-posta) | E-posta adresi, doğrulama/sıfırlama e-postaları | Bölge doğrulanmadı; DPA yok | İnceleme gerekli |
| **Daily** (sesli oda) | Oda adı (sayısal), token (4 sa), ses medyası (WebRTC) | ABD/global; DPA yok; kayıt/log saklaması doğrulanmadı | İnceleme gerekli |
| **Firebase/Google** (Android bildirimi) | Cihaz anahtarı + **genel** bildirim metni (mesaj içeriği/gönderen adı gönderilmez) | ABD; DPA yok | İnceleme gerekli |
| Tarayıcı push servisleri (Google/Mozilla/Apple) | Abonelik uç noktası + şifreli genel bildirim | Tarayıcıya bağlı | İnceleme gerekli |
| Off-site yedek deposu (yapılandırılırsa) | **Şifreli** yedek (sağlayıcı içeriği okuyamaz) | Henüz seçilmedi | Seçildiğinde eklenmeli |

Not: Yurt dışı aktarım mekanizması (yeterlilik kararı/standart sözleşme/taahhüt vb.) ve Kurum'a bildirim yükümlülükleri **teknik olarak çözülemez**; hukukçu güncel Yönetmelik'e göre değerlendirmelidir. Bu çalışmada sözleşme imzalanmamış, Kurum'a bildirim yapılmamıştır.
