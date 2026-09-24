# "Silinmiş hesap" DM sohbeti saklama politikası (teknik)

> ## Bu süre onaylı değildir
> Aşağıdaki **90 günlük süre KVKK Kurumu ya da başka bir makam tarafından belirlenmiş, öngörülmüş veya tavsiye edilmiş bir süre
> değildir.** Karşı tarafın konuşma geçmişini makul bir süre korumak ile kişisel verileri gereğinden uzun tutmamak arasında seçilmiş
> **teknik bir ürün varsayılanıdır** ve **hukuki incelemeye tabidir** (işleme amacı, hukuki sebep ve azami süre bir hukuk
> danışmanıyla doğrulanmalıdır). Süre `server/db.js` içindeki `DELETED_DM_RETENTION_DAYS` sabitinde tutulur.

## Kapsam

Yalnızca **hesabı silinmiş bir kullanıcı nedeniyle salt okunur hâle gelen** özel mesaj (DM) sohbeti (oda anahtarı `dmdel_…`).
**Normal, aktif DM'ler için bu değişiklikle yeni bir saklama süresi tanımlanmamıştır.** (Güncelleme: Aşama 15B ile aktif lobi/DM mesajları için ayrı bir teknik saklama modeli eklenmiştir; bkz. `mesaj-saklama-politikasi.md`. Bu belgedeki 90 günlük süre yalnızca "silinmiş hesap" sohbeti içindir.) Lobi mesajları, karşı tarafın diğer DM'leri ve
rapor kanıtları (`report_evidence`, `report_evidence_media`) bu politikanın dışındadır.

## Davranış

Bir hesap silindiğinde (bkz. `deleteAccount`, tek transaction):

| Veri | Ne olur |
|---|---|
| Silinen hesabın mesajları, ekleri, kullanıcı adı, gönderen bağlantıları | **Hesap silme işleminde (aynı transaction'da) silinir; yedekler ve sağlayıcı kopyaları bu kapsamın dışındadır.** Karşı tarafın sohbetinde konuşmanın sırası bozulmasın diye içeriksiz bir "mezar taşı" satırı kalır (içerik, ek, ad ve gönderen bağlantısı yok; yalnızca zaman damgası ve alıcı). |
| Karşı tarafın **kendi** mesajları (metin + medya) | Karşı tarafın verisi olarak **geçici korunur**; silinen hesapla bağlantısı (alıcı, oda) kaldırılır. Karşı taraf bunları "Silinmiş hesap" adlı salt okunur sohbette görür. |
| Karşı tarafın o konuşmada hiç (silinmemiş) mesajı yoksa | Korunacak bir şey yoktur; silinen hesabın mesajları da tamamen silinir. |

## Süre (retention)

- **Başlangıç:** hesap silme anı. Bu an, sohbetin oda anahtarına epoch saniye olarak yazılır: `dmdel_<karşı taraf no>_<rastgele jeton>_<silme anı>`.
  Şema değişikliği yoktur; anahtar yalnızca bir sayı taşır, kişisel veri içermez.
- **Süre:** **90 gün** (teknik varsayılan).
- **Dolunca:** o sohbetin tüm satırları silinir: karşı tarafın korunan mesajları, ilgili medya (mesajın `payload`'ı), mezar taşları ve tepkiler.
  Yalnızca `dmdel_` odalarına dokunulur; karşı tarafın hesabındaki diğer mesajlar, diğer DM'ler, lobi mesajları ve rapor kanıtları etkilenmez.
  Oda anahtarı çözümlenemeyen satırlar silinmez.
- **Erken silme:** karşı taraf sohbeti süre dolmadan kendisi de silebilir (mevcut manuel silme); süre dolunca silinecek bir şey kalmaz.
- **Karşı taraf da hesabını silerse** sohbet (mesajlar + mezar taşları) hesap silme işleminde (aynı transaction'da) tamamen silinir (yedekler kapsam dışıdır).

## Ne zaman çalışır

`purgeExpiredDeletedDmThreads()` sunucu **açılışında** ve **saatte bir** çalışır (bildirim/outbox temizliğiyle aynı desende). Tekrar çalıştırmak zararsızdır.
Silme `secure_delete` açıkken yapılır ve WAL kırpılır. Günlüğe yalnızca sayaçlar (sohbet ve mesaj sayısı) yazılır.
Sona erme kararı yalnızca oda anahtarındaki silme anına bakar; bu nedenle sunucu kapalıyken süresi dolan sohbetler ilk açılışta temizlenir.

## Arayüz

Karşı taraf sohbeti "Silinmiş hesap" adıyla salt okunur görür ve sohbetin otomatik silineceği tarih gösterilir. Hesap, karşı tarafın DM penceresi
açıkken silinirse mevcut Socket.io kullanıcı odası üzerinden `dm_partner_deleted` olayı gönderilir; pencere sayfa yenilemeden salt okunur
"Silinmiş hesap" görünümüne geçer (korunacak mesaj yoksa kapanır). Olay yalnızca DB işlemi başarıyla tamamlandıktan sonra gönderilir.

## Yedekler

Bu temizlik yalnızca canlı veritabanını kapsar. Render yedekleri/anlık görüntüleri ayrı bir yaşam döngüsüne sahiptir ve süresi dolan sohbeti
kendi saklama süreleri dolana kadar içerebilir (bkz. `rapor-kaniti-saklama-politikasi.md`, "Yedekler").
