'use strict';

// ── Tek tek açılabilen (ve hediye edilebilen) özellikler: TEK KAYIT YERİ ─────────────────────────────────────────
// Yeni bir Plus/Premium özelliği eklerken buraya bir satır ekle:
//   • hasFeature(userId, key) bunu kullanır (aktif abonelik hepsini açar; Hediye Aracı'ndan tek özellik verilen kullanıcı yalnızca onu kullanır),
//   • Hediye Aracı kataloğu (GIFT_PRODUCTS) buradan OTOMATİK üretilir — ayrıca elle eklemeye gerek yok,
//   • İstemcide kullanıcının açık özellikleri /api/me → features ile gelir (userHasFeature(key)).
// tier: 'plus' = aktif Plus VEYA Premium hepsini açar; 'premium' = yalnızca aktif Premium açar.
// early_access_until (isteğe bağlı, ISO tarih): o tarihe kadar özellik YALNIZCA Premium'a (ya da hediye edilene) açıktır; sonra normal kademesine iner.
//   Aynı alan server/atmosphere.js'teki paketlerde de geçerlidir. Premium'un "yeni içeriklere erken erişim" vaadi budur.
// Atmosphere paketleri için ayrıca server/atmosphere.js (ATMOSPHERES) → Hediye Aracı'nda "Atmosphere: <ad>" olarak otomatik görünür.
// server/test-atmosphere.js, bu kayıtların tamamının Hediye Aracı'nda göründüğünü denetler (eklenip unutulursa test düşer).
const FEATURES = {
  profile_theme:        { label: 'Profil teması',                    tier: 'plus' },
  profile_effect:       { label: 'Profil efekti',                    tier: 'plus' },
  name_effect:          { label: 'İsim efekti',                      tier: 'plus' },
  lobby_theme:          { label: 'Lobi teması',                      tier: 'plus' },
  lobby_image:          { label: 'Lobi görseli hakkı',               tier: 'plus' },
  custom_emoji:         { label: 'Özel emoji',                       tier: 'plus' },
  sticker_pack:         { label: 'Sticker paketi',                   tier: 'plus' },
  chat_theme:           { label: 'Sohbet teması',                    tier: 'plus' },
  bubble_style:         { label: 'Mesaj balonu stilleri',            tier: 'plus' },
  profile_sound:        { label: 'Profil sesi seçimi',               tier: 'plus' },
  gif_banner:           { label: 'Hareketli (GIF) kapak fotoğrafı',  tier: 'plus' },
  premium_sticker_pack: { label: 'Premium çıkartma paketi',          tier: 'premium' },
  gif_avatar:           { label: 'Hareketli (GIF) profil fotoğrafı', tier: 'premium' },
  premium_emoji_pack:   { label: 'Premium emoji paketi',             tier: 'premium' },
  premium_card:         { label: 'Premium üye kartı animasyonu',     tier: 'premium' }
};

module.exports = { FEATURES };
