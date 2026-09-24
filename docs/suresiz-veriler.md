# Süresiz kalan verilerin kademeli sınırlanması (Aşama 6)

> Süreler **teknik varsayılandır**; hukuken belirlenmiş süreler değildir ve **hukuki doğrulama gerektirir** (bkz. `veri-saklama-hukuki-eslestirme.md`). Amaç: kullanıcıyı şaşırtmadan, uyarıyla ve geri dönüşü olan adımlarla süresizliği kaldırmak.
> Aktif kullanıcı hesabı ve aktif lobi **otomatik silinmez**. Sayaçlar dağıtım anında başlar: mevcut hiçbir hesap/davet ilk açılışta süresi dolmuş sayılmaz.

| Veri | Neden saklanıyor / kullanıcıya gösteriliyor mu | Sahibi hesabını silince | Erişim / export | Kişisel veri | Yeni sınır | Açık kalan |
|---|---|---|---|---|---|---|
| **Hareketsiz hesap** (`users`) | Hesap sürekliliği; giriş olmadan da hesap sürer | Satır ve bağlantılar silinir (atomik) | Kullanıcı; moderatör sınırlı; export'a girer | Evet | **730 gün** hiç oturum etkinliği yoksa: 30 gün önce **e-posta uyarısı** → giriş yapılmazsa **silme** (kullanıcının kendi silmesiyle aynı yol). Hariç: yönetim rolleri, askıdakiler, etkin üyeleri olan lobilerin sahipleri. E-posta gönderilemezse **silinmez**. Kapatma anahtarı: `INACTIVE_ACCOUNT_DELETION=off` | Hukuki: süre dayanağı |
| **Hareketsiz lobi** (`hubs`) | Lobi verisi mesaj saklamasıyla zaten sınırlı (730 gün hareketsiz sohbet silinir); üyelik/rol/davet meta verisi düşük hassasiyette | Sahibi silince lobi ve içeriği silinir | Lobi üyeleri | Düşük (adlar, roller) | Lobi **süre doldu diye silinmez** (aktif topluluğu şaşırtır); yaşam döngüsü **sahibinin hesabına** bağlıdır: hareketsiz sahip silinince lobi de gider (etkin üyeleri varsa sahip silinmez) | Hukuki/ürün: boş lobi süresi |
| **Öneri panosu** (`feedback`, `feedback_votes`) | Ürün fikirleri; giriş yapan herkese görünür | Kullanıcının önerisi/oyları silinir | Giriş yapmış kullanıcılar; export'a girer | Evet (serbest metin + yazar) | **730 gün** sonra otomatik silinir (oylarla) | — |
| **Davet kodları** (`hub_invites`) | Lobiye katılım; kod yalnızca oluşturma anında gösterilir | Kullanıcının davetleri silinir | Lobi yöneticileri | Düşük (oluşturan numarası) | **180 gün kullanılmazsa** silinir (`last_used_at`); süresi dolan kodla katılım reddedilir; **oluşturma ekranında süre gösterilir**; tükenen (`max_uses`) davet 7 gün sonra silinir | — |
| **Bekleyen arkadaşlık isteği** (`friendships` pending) | Karşı tarafın yanıtı; bildirim 90 gün zaten siliniyordu | Silinir (cascade) | İlgili iki kullanıcı | İki hesap ilişkisi | **90 gün** yanıtlanmazsa silinir (gönderen yeniden isteyebilir); kabul edilmiş arkadaşlık etkilenmez | — |
| **Cihaz anahtarları** (`push_subscriptions`, `fcm_tokens`) | Bildirim | Silinir (cascade) | Sunucu | Cihaz kimliği | Sağlayıcı geçersiz dediğinde silinir; kullanıcı başına ≤ 10; hesap hareketsizliğiyle sınırlı | Ölü ama "geçerli" anahtarın süresi: teyit/ürün kararı |
| **Engellemeler / kabul edilmiş arkadaşlıklar** | Kullanıcı tercihi/güvenlik | Silinir | İlgili kullanıcı | İlişki | Kullanıcı kaldırana ya da hesap silinene kadar (hesap sınırlaması yukarıda) | — |

## Kullanıcıya görünürlük
* Davet kodu oluşturulunca "Bu kod 180 gün hiç kullanılmazsa otomatik silinir." gösterilir.
* Hareketsiz hesap: silmeden en az 30 gün önce **e-posta** ile bildirilir; giriş yapmak sayacı sıfırlar.
* Gizlilik politikası Bölüm 6 bu kuralları (TR/EN) açıklar.

## Tasarım kararları
* **Kademeli:** eşik (730 gün) → uyarı (e-posta) → en az 30 gün bekleme → silme. Uyarı başarısızsa silme yapılmaz.
* **Aktif kullanıcıyı şaşırtmama:** etkinlik = geçerli oturumla herhangi bir API/soket kullanımı (günde en çok bir yazma). Aktif üyesi olan lobinin sahibi silinmez.
* **Kayıt:** temizlik olayları kişisel veri içermeyen `data_lifecycle_log`'a sayaç olarak yazılır.
