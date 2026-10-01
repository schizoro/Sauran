# Sauran — Yapılacak Özellikler (Yol Haritası)

Sıra, kullanıcı deneyimine etkisi ve yapım kolaylığına göre belirlendi. Her madde tamamlandıkça işaretlenir; adım adım ilerlenir.

Durum: `[ ]` sırada · `[~]` yapılıyor · `[x]` tamamlandı

## 1. Sohbetin temel eksikleri
- [x] **Eski mesajları yükleme** — Lobi sohbeti ve DM'de yukarı kaydırınca 50'şer mesajlık eski sayfalar gelir; mesaj tablosuna dizin eklendi.
- [x] **Kalıcı okunmamış göstergesi** — DM ve lobi okunmamış sayıları sunucuda tutulur; yenileme ve cihazlar arası doğru, bir cihazda okununca diğerinde de sıfırlanır.
- [~] **@bahsetme** — Birini etiketleyince ona özel bildirim.
- [ ] **"Yazıyor…" göstergesi**
- [ ] **Mesaj arama**
- [ ] **Lobide çoklu metin kanalı** (#genel, #oyun …)

## 2. Hesap güvenliği
- [ ] İki adımlı doğrulama (2FA)
- [ ] E-posta adresini değiştirme

## 3. Moderasyon
- [ ] Yavaş mod (mesajlar arası zorunlu bekleme)
- [ ] Kelime filtresi / otomatik moderasyon
- [ ] Lobi içi moderasyon kaydı (kim kimi attı/banladı/susturdu)
- [ ] Davet kodlarına süre ve kullanım sınırı

## 4. Ses ve medya
- [ ] Bas-konuş (push-to-talk)
- [ ] GIF arama
- [ ] Link önizlemesi
- [ ] Kamera / görüntülü görüşme *(şu an bilinçli olarak yok; karar gerekli)*

## 5. Platform ve ticari
- [ ] Grup DM
- [ ] iOS yerel uygulama *(şu an PWA)*
- [ ] Ödeme sistemi *(bilinçli olarak kapalı beta + hukuki inceleme sonrasına bırakıldı; bkz. `ucretlendirme-hazirlik.md`)*

## Tamamlananlar (Ekim 2026)
- [x] iPhone'da ekran paylaşımı tam ekran düzeltmesi
- [x] Güvenlik denetimi ve düzeltmeleri (XSS, IDOR, güvenlik başlıkları, gövde sınırı, hız sınırları, Daily token)
- [x] Sesli odada kalıcı, süreli susturma (30 / 60 dk / kaldırılana kadar) + Susturulanlar listesi
- [x] Ekran sesinin yalnızca "İzle" diyene çalınması
- [x] Sesli odadan atma (anlık / 30 / 60 dk / kaldırılana kadar) + Odaya Girişi Engellenenler listesi
