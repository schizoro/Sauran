# Bildirim ve e-posta kuyruğu (outbox) saklama politikası (teknik)

> ## Bu süreler onaylı değildir
> Aşağıdaki süreler **KVKK Kurumu ya da başka bir makam tarafından belirlenmiş, öngörülmüş veya tavsiye edilmiş süreler
> değildir.** Ürün davranışı gözetilerek seçilmiş **teknik varsayılanlardır** (kullanıcıya gösterilmesi için gereken en kısa makul
> pencere). Gerçek azami saklama süreleri, işleme amacına ve hukuki sebebe göre bir hukuk danışmanıyla doğrulanmalıdır.
> Süreler `server/db.js` içindeki `NOTIFICATION_RETENTION_DAYS` ve `OUTBOX_RETENTION_DAYS` sabitlerinde tutulur.

Kapsam yalnızca **uygulama veritabanıdır**. E-posta sağlayıcısındaki (Zoho) gerçek posta kutusu saklaması ve yedekler/anlık
görüntüler bu belgenin ve kodun kapsamı dışındadır.

## 1. `notifications` (kullanıcıya gösterilen bildirimler)

Kullanıcıya yalnızca `pending` (okunmamış / yanıt bekleyen) ve `seen` (okunmuş, listede duran) bildirimler listelenir.
`accepted`, `declined`, `read` durumundakiler artık hiçbir yerde gösterilmez ve bir işlevi yoktur.

| Bildirim durumu | Süre (oluşturulmadan) | Gerekçe |
|---|---|---|
| Yanıtlanmış / kapatılmış (`accepted`, `declined`, `read`) | **7 gün** | Listelenmiyor; yalnızca kısa bir teknik pencere |
| Okunmuş (`seen`), bilgilendirme | **30 gün** | Kullanıcı okudu; geçmiş görünümü için makul süre |
| Okunmamış (`pending`), bilgilendirme | **60 gün** | Uzun süre giriş yapmayan kullanıcı dönünce görsün |
| Yanıt bekleyen arkadaşlık isteği / lobi daveti (`pending`) | **90 gün** | Yanıt vermesi için daha uzun süre; sonra geçersiz sayılır |
| `platform_role_notice` (kabul bekleyen görev) | Süreyle silinmez | Kullanıcının rol kabul durumuna bağlıdır; mevcut `cleanupStalePlatformNotices` yönetir |

- Bildirim verisi başka kullanıcının kullanıcı adını (`from_username`) içerebilir; süreler bu adın gereğinden uzun tutulmasını sınırlar.
- Süreler yalnızca `created_at`'e bakar (okunma zamanı tutulmaz); bu yüzden "okundu" sayılan eski bir bildirim bir sonraki temizlikte gidebilir.

### Hesap silme ve başkalarının bildirimleri

- Silinen hesabın **kendi** bildirimleri silinir (mevcut davranış).
- Silinen hesabın **başkalarına** gönderdiği bildirimlerde kaynağın adı/kimliği kalmaz (`deleteAccount`, aynı transaction'da):
  - `friend_request` ve `friend_request_accepted`: **silinir** (yanıtlanamaz / anlamsız hâle gelir).
  - Diğerleri (ör. yaşayan bir lobinin `hub_invite`'ı): davet işlevsel kalsın diye **anonimleştirilir**: `from_username = "Silinmiş hesap"`, `from_user_id = null`.
- Bu kaynak temizliği periyodik temizlikte de çalışır: kaynağı artık `users` tablosunda olmayan (bu düzeltmeden önce silinmiş hesaplardan kalan) bildirimler aynı kurala göre silinir/anonimleştirilir.
- Bozuk JSON içeren satırlar (`json_valid` ile) atlanır; işlemi bozmaz.

## 2. `role_notice_email_outbox` (rol bildirim e-postası kuyruğu)

Tablo gerçek bir kuyruk gibi ele alınır: e-postanın **gövdesi/HTML'i ve alıcı adresi hiç saklanmaz**; e-posta gönderim anında
`users` tablosundaki güncel bilgilerden üretilir. Satırda yalnızca yeniden deneme için gereken teknik alanlar ve küçük bir
`payload` (ör. `{removed_role, current_role}`) bulunur.

| Durum | Ne olur |
|---|---|
| `pending` / `sending` | Yeniden deneme ihtiyacı sürerken **içerik (`payload`) korunur** (en çok 8 deneme, geri çekilme en çok 1 saat). |
| `sent` (başarılı) | **Gönderimden hemen sonra `payload` silinir** (`NULL`); yalnızca teknik metadata kalır (kullanıcı no, tür, rol, sürüm, deneme sayısı, `sent_at`). |
| `skipped` (atlandı) | `payload` hemen silinir. |
| `failed` (yeniden deneme bitti) | `payload` hemen silinir; hata metni tutulur (aşağıya bak). |
| Bitmiş satır (`sent`/`skipped`/`failed`) | Son işlemden **7 gün** sonra satır tamamen silinir. |
| Yeniden deneme penceresini aşmış `pending`/`sending` | Oluşturulmasından **7 gün** sonra silinir (yeniden deneme artık gerekmiyor). |

- **Hata metni (`last_error`)** SMTP hatalarında alıcı adresini içerebilir; saklanmadan önce e-posta benzeri ifadeler `[e-posta]` ile değiştirilir.
- Eski (bu düzeltmeden önce oluşmuş) bitmiş satırlardaki `payload` ve hata metnindeki e-posta adresleri ilk temizlikte silinir.
- Kullanıcı hesabı silinince satırlar zaten `ON DELETE CASCADE` ile gider.

## 3. Ne zaman çalışır

`purgeExpiredNotificationData()` sunucu **açılışında** ve **saatte bir** çalışır. İşlem idempotenttir (tekrar çalıştırmak zararsızdır),
`secure_delete` açık olarak silinir ve WAL kırpılır. Günlüğe yalnızca sayaçlar yazılır (ad, e-posta, içerik yazılmaz).

**İlk çalıştırmanın etkisi:** özelliğin yayına alındığı ilk açılışta, süresi geçmiş eski bildirimler ve bitmiş outbox satırları
toplu olarak silinir (geri alınamaz). Deploy öncesi veritabanı yedeği alınması önerilir.

## 4. Dokunulmayanlar

Bu temizlik `notifications` ve `role_notice_email_outbox` dışındaki hiçbir tabloya (mesajlar, audit log, rapor/kanıt, oturum vb.) dokunmaz.
