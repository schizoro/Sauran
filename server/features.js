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
  premium_card:         { label: 'Premium üye kartı animasyonu',     tier: 'premium' },
  personal_emoji:       { label: 'Kişisel emoji oluşturma',          tier: 'plus' },
  personal_sticker:     { label: 'Kişisel çıkartma oluşturma',        tier: 'plus' },
  animated_sticker:     { label: 'Hareketli çıkartma oluşturma',      tier: 'premium' },
  animated_emoji:       { label: 'Hareketli (GIF) emoji oluşturma',  tier: 'premium' },
  cross_lobby_emoji:    { label: 'Başka lobilerin emojilerini kullanma', tier: 'premium' }
};

// Premium üye kartı stilleri (premium_card özelliğiyle seçilir; Hediye Aracı'nda ayrı ürün gerekmez — özellik zaten giftable).
// group: classic | cute (pembe, sevimli) | strong (sert, güçlü). Yeni stil = buraya satır + client/theme.css'te .cs-<key> kuralı.
const CARD_STYLES = [
  { key: 'classic', label: 'Klasik Premium', group: 'classic', emoji: '✦' },
  { key: 'rose',    label: 'Pembe Gül',      group: 'cute',    emoji: '💗' },
  { key: 'teddy',   label: 'Ayıcık',         group: 'cute',    emoji: '🧸' },
  { key: 'bunny',   label: 'Tavşan',         group: 'cute',    emoji: '🐰' },
  { key: 'sakura',  label: 'Sakura',         group: 'cute',    emoji: '🌸' },
  { key: 'candy',   label: 'Şeker',          group: 'cute',    emoji: '🍭' },
  { key: 'fire',    label: 'Alev',           group: 'strong',  emoji: '🔥' },
  { key: 'thunder', label: 'Şimşek',         group: 'strong',  emoji: '⚡' },
  { key: 'steel',   label: 'Çelik',          group: 'strong',  emoji: '🛡️' },
  { key: 'frost',   label: 'Buz',            group: 'strong',  emoji: '❄️' },
  { key: 'dragon',  label: 'Ejderha',        group: 'strong',  emoji: '🐉' }
];
const CARD_STYLE_KEYS = CARD_STYLES.map((c) => c.key);

module.exports = { FEATURES, CARD_STYLES, CARD_STYLE_KEYS };
