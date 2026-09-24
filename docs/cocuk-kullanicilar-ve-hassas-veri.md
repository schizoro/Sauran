# Çocuk kullanıcılar: mevcut model, riskler, teknik korumalar ve hukuki karar noktaları

> **Uyarı:** Bu belge teknik durumu ve **riskleri** anlatır; hukuki sonuç ya da "yasaktır/serbesttir" hükmü vermez. Çocukların kişisel verisi, ebeveyn izni/bilgilendirmesi, çocuk güvenliği bildirim yükümlülükleri
> **koddan çıkarılamaz**; **hukuki politika gereklidir**. Kod, "çocuk güvenliği = daha uzun saklama" gibi süre varsayımları YAPMAZ (`child19_suite`, `child4_suite`).

## 1. Yaş modeli
* **Beyan esaslıdır:** kayıtta doğum tarihi girilir; 13 yaş altı reddedilir; kimlik/ebeveyn doğrulaması **yoktur**. Beyan gerçeğe aykırı olabilir; bu, aşağıdaki tüm korumaların doğruluğunu sınırlar.
* Tam doğum tarihi saklanmaz; 18 yaş altında yalnızca `minor_until` (18. yaş günü). "18 yaş altı" = `13–17` yaş.
* İleride gerçek yaş doğrulaması gerekip gerekmediği **teknik + ürün + hukuk kararıdır**; bu çalışmada kimlik doğrulama mekanizması eklenmemiştir.

## 2. Özellik bazında mevcut davranış (kod incelemesi)

| Özellik | 13–17 yaş için mevcut davranış | Değerlendirme |
|---|---|---|
| Kayıt | 13 yaş altı reddedilir; kayıtta `avatar_visibility='friends'` atanır | Uygulanıyor |
| Profil fotoğrafı / kapak | `avatar_visibility` **sunucuda uygulanır**: yabancıya gitmez (Aşama 19) | Düzeltildi |
| Biyografi | Arkadaş olmayana **gösterilmez** | Uygulanıyor |
| Çevrimiçi / manuel durum | **Bu çalışmada:** arkadaş olmayana "görünmez/çevrimdışı" gösterilir (profil + lobi üye listesi); arkadaşa ve kendisine gerçek durum | Yeni |
| Kullanıcı adı | Aynı lobideki tüm üyelere ve tam adı bilene görünür (işlev gereği) | Bilinçli |
| Arama / keşif | Genel kullanıcı/lobi **arama dizini yoktur**; kullanıcı numarası/adı bilinmeden bulunamaz; lobiye yalnızca davet koduyla girilir | Düşük görünürlük |
| Arkadaşlık (yetişkin → çocuk) | **Engel yoktur**: kullanıcı numarasını (lobi üye listesinden görülebilir) bilen herkes istek gönderebilir; **kabul çocuktadır** | **Risk / karar noktası** (bkz. §3) |
| Arkadaşlık (çocuk → yetişkin) | Serbest; karşı tarafın kabulü gerekir | Aynı |
| DM | Yalnızca kabul edilmiş arkadaşlar arasında; yabancı DM gönderemez | Uygulanıyor |
| Lobi/lobi üyelikleri | Davet koduyla; lobi yöneticileri üyelerin adlarını görür | Bilinçli |
| Sesli odalar / arama / ekran paylaşımı | Lobi üyeleri arasında; yaşa göre ayrım yok. Daily'ye kullanıcı adı gitmez (Aşama 1) | **Risk / karar noktası** |
| Davet sistemi | Kod tabanlı (kim oluşturduğu kayıtlı); yaş kısıtı yok | Bilinçli |
| Raporlama | Kategori "Çocuk güvenliği" → otomatik `critical`; rapor ve kanıta **yalnızca yetkili moderasyon** erişir (403 testli) | Uygulanıyor |
| Rapor kanıtı | Mesaj + minimum metadata; **yaş/doğum/kullanıcı adı/e-posta tutulmaz**; hesap silinince gönderen bağlantısı kopar | Uygulanıyor |
| Bildirimler (in-app) | Kısa ömürlü (7–90 gün); başkasının adı içerebilir; export'a girmez | Uygulanıyor |
| FCM / Web Push | Yalnızca genel metin + tür; içerik/ad/kimlik yok | Uygulanıyor |
| Export | Kullanıcı kendi verisini alır: `age_group`/`is_minor` var, tam doğum tarihi yok | Uygulanıyor |
| Hesap silme | Şifreyle doğrulanır; tek transaction; DB+WAL'da iz kalmaz (test) | Uygulanıyor |
| Günlük/denetim | Kullanıcı adı/e-posta/IP günlüğe yazılmaz; denetim kaydı yalnızca numara + kısa etiket | Uygulanıyor |

## 3. Yetişkin ↔ çocuk sosyal etkileşimi: risk değerlendirmesi
**Soru:** "Yetişkin ile çocuk arasındaki sosyal etkileşimi tamamen serbest bırakmak ürün ve çocuk güvenliği açısından kabul edilebilir mi?"

* **Gerçek risk (teknik/ürün):** Yetişkin bir kullanıcı, çocuğun numarasını ortak lobiden öğrenip arkadaşlık isteği gönderebilir; çocuk kabul ederse **özel mesaj, sesli arama ve medya paylaşımı** açılır. Yaş beyanı doğrulanmadığı için bilinen "yaş dışı" kullanıcılar da (yetişkin görünen çocuk, çocuk görünen yetişkin) mümkündür.
  Kabul mekanizması (çocuğun onayı) tek koruma katmanıdır; yaş farkı, ilk mesaj kısıtı, uyarı metni veya ebeveyn görünürlüğü **yoktur**.
* **Güvenli teknik seçenekler (uygulanmadı; ürün kararı gerekir):**
  1. Yetişkin → 18 yaş altı arkadaşlık isteğini engellemek veya yalnızca ortak lobi/onaylı davetle izin vermek.
  2. 18 yaş altına gelen isteklerde belirgin uyarı/raporlama kısayolu göstermek.
  3. 18 yaş altı hesaplar için DM'yi yalnızca aynı yaş grubuyla sınırlamak.
  4. 18 yaş altı hesaplar için lobi üye listesinde tam adı yalnızca arkadaşlara göstermek.
  Bu seçeneklerin her biri sosyal özelliği **kısıtlar** ve ürün deneyimini değiştirir; bu yüzden kod bunları **kendi başına** uygulamaz.
* **Hukuki inceleme gerektiren nokta:** Çocuğun rızası/ebeveyn izni, çocuklara yönelik hizmetlerde alınması gereken tedbirler, ihbar/bildirim yükümlülükleri ve platformun sorumluluğu — resmî KVKK rehberleri ve ilgili mevzuata göre bir hukukçu tarafından değerlendirilmelidir.
* **Bu çalışmada yapılan doğrudan teknik iyileştirmeler:** çocuğun görünürlüğünün azaltılması (görsel, biyografi, çevrimiçi durum), rapor/kanıt erişiminin doğrulanması, silme izinin doğrulanması, bildirim/log/denetim minimizasyonunun doğrulanması.

## 4. Hukuki politika gerektiren / açık kalan noktalar
1. Reşit olmayan kullanıcılarda veri işleme dayanağı, açık rıza/ebeveyn bilgilendirmesi (KVKK'nın güncel rehberleri ve mevzuat) — **hukuki politika gerekli**.
2. Çocuk güvenliği raporları için **özel saklama süresi, resmî makamlara bildirim/aktarım yükümlülüğü** — **hukuki politika gerekli**; kod süre icat etmez (tüm nedenler aynı süreleri kullanır).
3. Yetişkin→çocuk etkileşim kısıtı (yukarıdaki seçenekler) — **ürün + hukuk kararı**.
4. Yaş doğrulaması (kimlik/ebeveyn) gerekliliği — **ürün + hukuk kararı**.
5. Ses/görüntü/görsel içerikte çocuk verisi ve özel nitelikli veri için ek koruma/bildirim süreçleri.
