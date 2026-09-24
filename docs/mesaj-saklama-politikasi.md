# Mesaj saklama modeli (Aşama 15B) — teknik varsayılanlar

> **Uyarı:** Buradaki süreler ve kurallar **teknik ürün varsayılanlarıdır**. KVKK Kurumu ya da başka bir makam tarafından belirlenmiş süreler
> **değildir** ve hukuki uygunluk garantisi vermez. Yayın öncesinde **hukuki doğrulama gerekir**. Süreler `server/db.js` içindeki
> `MESSAGE_RETENTION` sabitinde tek yerdedir.

## Model

Mesajın parçaları ayrı yaşam döngüleriyle ele alınır (`purgeExpiredMessages`, `server/db.js`; açılışta ve saatte bir çalışır):

| Parça | Kural | Varsayılan |
|---|---|---|
| **Medya** (ses/görsel/video/dosya; `payload` içindeki base64) | Süre dolunca base64 silinir. Mesaj satırı, metni, dosya adı/türü/boyutu/süresi kalır; `payload.expired = true`. Arayüz "medya süresi doldu (silindi)" gösterir. | 90 gün |
| **Metin + yardımcı veri** (içerik, reply/pin/reaction/poll bağları) | Bir sohbetteki (lobi = `hub_N`, DM = `dm_a_b`) **en yeni 200 mesaj yaşından bağımsız korunur**. Bunların dışında kalan ve süresi dolan mesajlar silinir. **Sabitlenmiş** mesajlar bu kurala takılmaz. | 365 gün, 200 mesaj |
| **Hareketsiz sohbet** | Bu süre boyunca hiç mesaj gelmeyen sohbetin tüm mesajları (sabitlenmişler dahil) silinir. Aksi halde "son N mesaj" koruması sonsuz olurdu. | 730 gün |

* Arayüzün "son 50 mesaj" limiti (`getHubMessages` / `getDmMessages`) **ayrı bir kavramdır**; korunan pencere (200) kasıtlı olarak daha büyüktür ve
  arayüz limiti değişse bile saklama davranışı değişmez.
* **Kapsam dışı:** "Silinmiş hesap" DM odaları (`dmdel_…`, kendi 90 günlük süresi), rapor kanıtları (`report_evidence*`, kendi `retention_until` süresi),
  bildirimler, denetim kayıtları ve diğer tablolar kendi mekanizmalarına tabidir.

## Silinen mesajın ilişkileri

Bir mesaj saklama süresi nedeniyle silindiğinde:

* Tepkileri ve anket oyları silinir; **yetim kayıt kalmaz**.
* Ona verilmiş yanıtların `reply_to_message_id` bağlantısı kaldırılır (yanıtın kendisi korunur; alıntı görünmez).
* **Forward kopyaları kaynağın yaşam döngüsünü atlayamaz:** Kaynak (kök) mesaj silinirse zincir halindeki tüm kopyalar içeriksiz mezar taşı olur
  (Aşama 15A ile aynı mantık). Kaynağın **medyası** dolarsa kopyaların medyası da (kopya daha yeni olsa bile) silinir.
* Bir **kopya** silinirse yalnızca o silinir; ondan iletilenler üst kaynağa yeniden bağlanır.

## Kullanıcıya yansıma

* Gizlilik politikası Bölüm 6'da süreler "teknik varsayılan, doğrulanmalı" notuyla listelenir.
* Medya süresi dolan mesajlarda arayüz açıkça "medya süresi doldu (silindi)" der.
* Silinen eski mesajlar kullanıcıya zaten gösterilmediği (arayüz son 50 mesajı yükler) için görünür geçmiş, 200 mesajlık pencere sayesinde bozulmaz.
* Dışa aktarım (KVKK md. 11) yalnızca **mevcut** verileri içerir: süresi dolan medya `attachment: null`, `payload.expired: true` olarak, silinen mesajlar hiç yer almaz.

## Ürün açısından dikkat

* Pencere (200) ve süreler değiştirilirse gizlilik politikası, `docs/veri-envanteri-yasam-dongusu.md` ve testler (`msgret_suite`) birlikte güncellenmelidir.
* Saklama süresi nedeniyle silinen mesaja bağlı rapor kanıtı **etkilenmez**; moderasyon panelinde mesaj durumu "mesaj artık yok" olarak görünür.
* Yedeklerde silinen mesajlar bir süre daha bulunabilir (bkz. yedekler belgesi, Aşama 18); sağlayıcı süreleri doğrulanmamıştır.
