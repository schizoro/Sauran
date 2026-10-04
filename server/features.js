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
  cross_lobby_emoji:    { label: 'Başka lobilerin emojilerini kullanma', tier: 'premium' },
  cross_lobby_sticker:  { label: 'Başka lobilerin çıkartmalarını kullanma', tier: 'premium' }
};

// Hediye Aracı görsel kataloğu için ayrıntılar (kategori, simge, açıklama). Yeni bir özellik eklerken buraya da bir satır ekle;
// eklenmezse özellik "Diğer" kategorisinde adıyla yine görünür (hiçbir ürün kaybolmaz).
const FEATURE_GROUPS = [
  ['profile', '👤', 'Profil & Kimlik'],
  ['chat', '💬', 'Sohbet'],
  ['lobby', '🏠', 'Lobi'],
  ['emoji', '😊', 'Emoji & Çıkartma'],
  ['other', '✨', 'Diğer']
];
const FEATURE_META = {
  profile_theme:        { group: 'profile', icon: '🎨', desc: 'Profil penceresinin renk teması (Gece, Gün Batımı, Orman, Sakura, Okyanus).' },
  profile_effect:       { group: 'profile', icon: '🌸', desc: 'Profil avatarının çevresinde animasyonlu efekt (Sakura, Sahne Işıkları).' },
  name_effect:          { group: 'profile', icon: '🔤', desc: 'Kullanıcı adına animasyonlu efekt (Gradyan, Parıltı, Gökkuşağı, Işıltı).' },
  profile_sound:        { group: 'profile', icon: '🎧', desc: 'Profil açıldığında çalan sesi seçme.' },
  gif_avatar:           { group: 'profile', icon: '🎞️', desc: 'Hareketli (GIF) profil fotoğrafı yükleyebilme.' },
  gif_banner:           { group: 'profile', icon: '🖼️', desc: 'Hareketli (GIF) kapak fotoğrafı yükleyebilme.' },
  premium_card:         { group: 'profile', icon: '🃏', desc: 'Lobi üye listesinde animasyonlu Premium üye kartı; 11 stil (Gül, Ayıcık, Tavşan, Alev, Şimşek, Ejderha…).' },
  chat_theme:           { group: 'chat', icon: '🌙', desc: 'Sohbet teması (Yumuşak, Kontrast).' },
  bubble_style:         { group: 'chat', icon: '💭', desc: 'Mesaj balonu stilleri (Yuvarlak, Cam, Çerçeve, Gölge).' },
  lobby_theme:          { group: 'lobby', icon: '🎭', desc: 'Kendi lobisine tema seçebilme.' },
  lobby_image:          { group: 'lobby', icon: '🏞️', desc: 'Kendi lobisine arka plan görseli koyabilme.' },
  custom_emoji:         { group: 'emoji', icon: '🧩', desc: 'Lobi emojisi hakkı.' },
  sticker_pack:         { group: 'emoji', icon: '🐱', desc: 'Plus hareketli çıkartma paketi (31 karakter).' },
  premium_sticker_pack: { group: 'emoji', icon: '🐲', desc: 'Premium hareketli çıkartma paketi (12 büyük karakter).' },
  premium_emoji_pack:   { group: 'emoji', icon: '👑', desc: 'Premium tepki emojileri (🐉 🦄 👑 💎 🌟 🚀 …).' },
  personal_emoji:       { group: 'emoji', icon: '📷', desc: 'Kendi emojilerini yükleme (10 adet, otomatik sıkıştırılır).' },
  animated_emoji:       { group: 'emoji', icon: '🎞️', desc: 'Hareketli (GIF) kendi emojisi; 30 emojiye kadar.' },
  cross_lobby_emoji:    { group: 'emoji', icon: '🌐', desc: 'Üyesi olduğu başka lobilerin emojilerini her yerde kullanma.' },
  personal_sticker:     { group: 'emoji', icon: '🖼️', desc: 'Kendi çıkartmalarını yükleme (5 adet).' },
  animated_sticker:     { group: 'emoji', icon: '✨', desc: 'Hareketli kendi çıkartması; 15 çıkartmaya kadar.' },
  cross_lobby_sticker:  { group: 'emoji', icon: '🌐', desc: 'Üyesi olduğu başka lobilerin çıkartmalarını kullanma.' }
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

module.exports = { FEATURES, FEATURE_GROUPS, FEATURE_META, CARD_STYLES, CARD_STYLE_KEYS };
