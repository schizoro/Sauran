# Çocuk kullanıcılar ve hassas veri (Aşama 19)

> **Uyarı:** Bu belge teknik durumu anlatır. Çocukların kişisel verisi, ebeveyn izni/bilgilendirmesi, çocuk güvenliği bildirim yükümlülükleri ve özel nitelikli kişisel veri
> konularındaki hukuki yükümlülükler **koddan çıkarılamaz**; **hukuki politika/doğrulama gereklidir** ve bu belgede icat edilmemiştir.
> Kod, "çocuk güvenliği = daha uzun saklama" ya da "hassas içerik = süresiz saklama" gibi varsayımlar YAPMAZ (bkz. `child19_suite`).

## Mevcut durum (koddan doğrulandı)

| Konu | Durum |
|---|---|
| 13 yaş altı kayıt | Reddedilir (giriş anında hesaplanır, saklanmaz). Beyan tabanlıdır; kimlik doğrulama yoktur. |
| 13–17 yaş varsayılanı | Kayıtta `avatar_visibility = 'friends'`, `is_minor = true`. |
| 18 yaş | `minor_until` günü gelince otomatik reşit (Aşama 13). |
| DM | Yalnızca kabul edilmiş arkadaşlar arasında; yabancı bir kullanıcı çocuğa DM gönderemez. |
| Arkadaşlık isteği | Kullanıcı adını bilen herkes istek gönderebilir (yaş ayrımı yok) — **ürün/hukuk kararı gerekir** (aşağıya bkz.). |
| Raporlama | `child_safety` kategorisi otomatik `critical`; rapor ve kanıta yalnızca yetkili moderasyon erişir (normal kullanıcı/lobi sahibi 403). |
| Bildirim yükü | FCM/Web Push yalnızca genel metin + tür taşır (Aşama 9–10); içerik/ad/kimlik yok. |
| Saklama | Çocuğa özel (daha uzun ya da daha kısa) süre **yok**; mesaj/medya/rapor kanıtı süreleri yaştan bağımsızdır. |

## Bu aşamada bulunan ve düzeltilen gerçek açık

`users.avatar_visibility` ('public'/'friends'/'private') kayıtta 13–17 yaş için `friends` atanıyordu ve ayarlarda değiştirilebiliyordu, ancak **sunucuda hiçbir yerde uygulanmıyordu**:
profil, lobi mesajları, lobi üye listesi ve arkadaş listesi başkasının `avatar_data`/`banner_data` alanını ayara bakmadan döndürüyordu (Çocuk Güvenliği sayfasındaki "yalnızca arkadaşlara açık" ifadesi
görseller için fiilen doğru değildi). Düzeltme:

* `avatarVisibleTo` / `maskAvatarFor` (`server/db.js`): **kendisi** her zaman; `public` herkes; `friends` yalnızca kabul edilmiş arkadaşlar; `private` ve bilinmeyen yalnızca kendisi.
  Uygulanan yerler: profil (avatar + kapak), lobi mesajları (REST), DM mesajları, silinmiş-hesap sohbeti, lobi üyeleri, banlılar, arkadaşlar, engellenenler.
* **Canlı yayın** (odaya giden mesaj) alıcıya özel üretilemediğinden görüntüleyensiz maskelenir: yalnızca `public` avatarlar yayınlanır. İstemci, REST ile aldığı (kendi yetkisine göre süzülmüş) görseli
  önbellekten (`knownAvatars`) ve kendi görselini `currentUser`'dan kullanır; böylece arkadaşlar ve kişinin kendisi için görünüm bozulmaz.
* **18 yaş altı biyografi:** serbest metin biyografi arkadaş olmayanlara (ve oturumsuz görüntüleyene) gösterilmez.
* Ham `avatar_visibility` alanı API yanıtlarında sızmaz.

## Değiştirilmeyenler / bilinçli kararlar

* Çocuk özel özellikleri yeniden tasarlanmadı; DM, lobi, ses ve raporlama akışları aynen çalışır.
* Rapor kanıtı, mesaj saklama, bildirim ve denetim kayıtlarına çocuk/hassas içeriğe özel süre eklenmedi.
* İçerik sınıflandırması (özel nitelikli veri tespiti) yapılmaz; kullanıcı mesajlarında özel nitelikli veri bulunabilir ve bu, genel süre kuralına tabidir.

## Hukuki politika gerektiren / açık kalan noktalar

1. Reşit olmayan kullanıcıların açık rızası, ebeveyn bilgilendirmesi ve veri işleme dayanağı (KVKK kapsamı) — **hukuki politika gerekli**.
2. Çocuk güvenliği raporlarının (ör. istismar bildirimleri) saklama süresi ve yetkili makamlara bildirim yükümlülüğü — **hukuki politika gerekli**; kod özel süre icat etmez.
3. Yetişkin → 18 yaş altı **arkadaşlık isteği** kısıtı (ör. yaş farkı, davetle ekleme) ürün ve hukuk kararı gerektirir; teknik olarak `friendship` oluşturmadan önce yaş grubu kontrolü eklenebilir.
4. Yaş beyanının doğrulanması (kimlik/ebeveyn doğrulaması) yoktur.
5. Ses/video/görsel içerikte özel nitelikli veri ve çocuk içeriği için ek koruma/bildirim süreçleri.
