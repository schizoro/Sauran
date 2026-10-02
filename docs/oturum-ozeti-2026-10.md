# Sauran — bulut oturumu değişiklik özeti (30 Eylül – 2 Ekim 2026)

> Bu dosya, bulutta (claude.ai) çalışan Claude oturumunda yapılan tüm işleri, bilgisayardaki Claude'un haberdar olması için özetler.
> Tüm değişiklikler `main` dalına commit'lenip GitHub'a (`schizoro/Sauran`) gönderildi. **Önce `git pull` yap.**
> Ayrıntı için: `git log --since=2026-09-30` ve `docs/yol-haritasi.md`.

## Çalışma düzeni / kurallar
- Yığın: Node/Express + Socket.io + better-sqlite3 (sunucu `server/`), tek sayfa istemci `client/` (`index.html`, `script.js`, `style.css`, `theme.css`, `shell.js`), Daily.co ses/görüntü, Capacitor (Android + iOS `mobile/`).
- Canlı: Render (`sauran.online`). `main`'e push = otomatik yayın.
- `client/theme.css` sonuna eklenen bloklar önceki kuralları ezer (bilinçli; yeni kurallar en sona eklenir).
- Gruplar (grup DM) ayrı tablo değil: `hubs.type = 'group'` olan lobilerdir.
- Commit mesajları Türkçe.

## Yeni özellikler (commit sırasıyla)
| Commit | Özellik |
|---|---|
| ecd4291 | Abonelik: GIF avatar Premium'a; dosya limiti Plus 50 / Premium 100 MB; bildirim sesleri ve profil rengi herkese açık |
| 4c37cd8 | iPhone'da ekran paylaşımı tam ekran düğmesi düzeltildi |
| c18f82d | Güvenlik denetiminde bulunan açıklar kapatıldı |
| d393d48, 546b881, 19870f2 | Sesli odada süreli/kalıcı susturma, sesli odadan atma (süre seçenekli) |
| aea3cd6 | Yukarı kaydırınca eski mesajları yükleme + `docs/yol-haritasi.md` |
| e9b500d | Kalıcı okunmamış mesaj göstergesi (DM + lobi) |
| 2b163de | @bahsetme + @everyone izni; lobi ayarları tam ekran yeni tasarım |
| 81ceaf1, eaa4e08 | Mesaj gecikmesi/zıplama/saat düzeltmeleri; doğrudan WebSocket, SQLite `synchronous=NORMAL`, gecikme ölçer |
| 61fc012 | "Yazıyor…" göstergesi |
| 5976e95 | Mesaj arama (lobi + DM) |
| 169a0ab, 8cd4ca8 | İki adımlı doğrulama (TOTP + kurtarma kodları, `server/totp.js`); kurulum ekranı sadeleştirildi |
| 14ad5f0 | E-posta adresini değiştirme (doğrulama e-postasıyla) |
| 8af9a6f | Lobide yavaş mod |
| 3d743ec | Lobi kelime filtresi — gizle/engelle, hazır TR+EN liste (`server/wordfilter.js`) |
| d471733 | Lobi moderasyon kaydı (modlog; 180 gün, içerik saklanmaz) |
| b7b1725 | Davet kodlarına süre ve kullanım sınırı |
| 977cf4b | Bas-konuş (push-to-talk) |
| 47e6c0e | Link önizlemesi (SSRF korumalı, görsel sunucu üzerinden proxylenir — `server/linkpreview.js`) |
| 83eb6b2 | Grup DM (en fazla N üye, grup ayarları, grup araması) |
| 1624910 | iPhone "ana ekrana ekle" rehberi |
| 6d50870, 15308d8, b388c36 | iOS uygulaması hazırlığı: Capacitor iOS projesi `mobile/ios/`, yerel eklentiler (arka plan ses, bildirim), APNs (`server/apns.js`), Universal Links (AASA rotası), Mac'siz derleme `.github/workflows/ios.yml`, rehber `docs/ios-yayin.md` |

## Arayüz değişiklikleri ve hata düzeltmeleri
- **e6f30cb** Profil: kullanıcı adı + Durumum kapağın altına (Hakkımda'nın üstü); kapat düğmesi daha görünür.
- **472bb95** Sol ray sırası: Ana Menü, Keşfet, Lobiler, Arkadaşlar, Arkadaş Ekle, Gruplar. Gruplar, Arkadaşlar'dan çıkıp kendi çekmecesine taşındı; üst çubuktaki "Lobiler" hamburgeri kaldırıldı; üst çubuk yükseltildi.
- **e19e27d** Telefon yan çevrilince takılan yakınlaşma (`maximum-scale=1`) ve yatay düzen.
- **81b66de** Balon efektleri iPhone'da donuyordu (GPU animasyonu + ekran dışındakiler duraklatılır, IntersectionObserver); DM ✕ gecikmesi (pointerup).
- **8e2fa02** Grup görünümünde lobi ayarları düğmesi görünmez (`body.in-group`).
- **e9f2dbb** (QA taraması) DM/lobi ek menüsü telefonda ekran dışına taşıyordu (`clampPopupToViewport`, animasyon düzeltildi); isimsiz grupların başlıkları (`groupDisplayName`).
- **e955331** Lobi yan panelleri (Üyeler, Sesli odalar): bilgisayarda (≥1101px) varsayılan **yan sütun** (sohbet kullanılabilir), Ayarlar → Genel'den "Açılır pencere"ye çevrilebilir (`localStorage sauran_sidedock`). Her panelde ✕ düğmesi. İlgili JS: `setHubSide`, `refreshHubSides`, `addSideCloseBtn`.
- **9a31977, 5d3054d** Telefonda lobi üst butonları (⭐ ⚙️ 👥): simgeler tam ortada, butonlar biraz geniş. Kök neden: JS ⚙️ butonuna satır içi `display:block` veriyordu (artık `''`).
- **4b55bb0** Telefonda mesaj işlemleri (😊 ↩ ⋯) yalnızca **balona** basılı tutunca açılır (`MSG_PRESS_TARGETS`); satırın büyük vurgu çerçevesi ve basılı tutunca metin seçimi kaldırıldı (Kopyala ⋯ menüsünde).
- **eeb6188** Telefonda üyeler paneli: açılınca donma (panelin backdrop-filter bulanıklığı + hareketli balon efektleri) — panel opak, açıkken efektler duraklar; ✕/boşluk ile kapanmama (pointerup); panel artık üst çubuğun altından başlar.
- **20d98ac** **Önemli hata:** soket yeniden bağlanınca (iPhone arka plan, sunucu yeniden başlatma) istemci lobi kanalına (`hub:<id>`) yeniden katılmıyordu → mesajlar kaydediliyor ama "Gönderilemedi" görünüyordu, gelen mesajlar akmıyordu. İstemci `connect`'te `join_hub` + mesajları yeniden yükler; sunucu `hub_chat_message`'da gönderen kanalda değilse kanala alır. Mesaj kutusundaki mavi odak çerçevesi kaldırıldı.

## Yeni dosyalar
`server/totp.js`, `server/wordfilter.js`, `server/linkpreview.js`, `server/apns.js`, `mobile/ios/**`, `.github/workflows/ios.yml`, `docs/ios-yayin.md`, `docs/oturum-ozeti-2026-10.md` (bu dosya). `server/db.js` ve `server/index.js`'e gruplar, davetler, modlog, yavaş mod, kelime filtresi, link önizlemesi, e-posta değişimi, `fcm_tokens.platform` eklendi (şema göçleri otomatik).

## Kullanıcının yapması gerekenler (bekleyenler)
1. Render'a `TOTP_ENCRYPTION_KEY` ekle ve bir kopyasını güvenli yerde sakla (2FA sırları bununla şifreli).
2. GIF araması: sağlayıcı seçimi (Tenor ya da GIPHY) — özellik bekletiliyor.
3. Render sunucusunu Frankfurt'a taşıma kararı.
4. Kamera (görüntülü) özelliği kararı.
5. Apple geliştirici hesabı → `docs/ios-yayin.md` adımları (Mac gerekmez).
6. Canlıda dene: e-posta değiştirme, 2FA, link önizlemesi, grup araması, ana ekrana ekleme, yan sütun paneli, yeniden bağlanınca mesaj gönderimi.
7. Ödeme sistemi (hukuki inceleme sonrası; iOS'ta Apple uygulama içi satın alma zorunlu).
