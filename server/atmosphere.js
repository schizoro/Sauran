'use strict';

// Sauran Atmosphere = Görsel tema + Ses + Animasyon + Efekt (tek paket). Saf veri; veritabanı/ağ kodu yok.
// Genişletilebilir: yeni paket eklemek = diziye bir nesne eklemek. `category`: included | limited | seasonal | coin.
// tier: 'plus' (Plus ve Premium) | 'premium' (yalnızca Premium) | 'coin' (Coin ile alınır; satın alma açılana kadar `purchasable` false).
// category: included | coin | limited | seasonal (mağaza filtreleri). price_coins: Coin fiyatı (null = satılık değil).
// bundle alanları mevcut kişiselleştirme sistemlerinin geçerli değerleridir (db.js ile aynı listeler).
// sound: istemcideki ses motorunun tarif anahtarı (client/atmosphere-audio.js). Yeni lisanslı ses dosyası eklenirse `audio_url` alanı kullanılabilir.

const ATMOSPHERES = [
  {
    key: 'cyber', label: 'Cyber Gaming', emoji: '🎮', tier: 'premium', category: 'included', price_coins: null,
    desc: 'Neon çizgiler, keskin vurgular ve oyuncu enerjisi.',
    art: 'linear-gradient(135deg,#0b1026 0%,#1b0f4a 45%,#00e5ff 130%)',
    bundle: { chat_theme: 'contrast', bubble_style: 'outline', profile_theme: 'midnight', name_effect: 'glow', profile_effect: 'stagelights' },
    sound: 'cyber',
    hub_theme: 'aurora', hub_effect: 'lights'
  },
  {
    key: 'midnight', label: 'Midnight Chill', emoji: '🌙', tier: 'plus', category: 'included', price_coins: null,
    desc: 'Koyu gece, yumuşak hareketler ve sakin bir ambient.',
    art: 'linear-gradient(135deg,#06081a 0%,#16224f 55%,#5a4fcf 130%)',
    bundle: { chat_theme: 'soft', bubble_style: 'glass', profile_theme: 'midnight', name_effect: 'shimmer', profile_effect: 'none' },
    sound: 'midnight',
    hub_theme: 'aurora', hub_effect: 'stars'
  },
  {
    key: 'cosmic', label: 'Cosmic', emoji: '🌌', tier: 'premium', category: 'included', price_coins: null,
    desc: 'Yavaş akan uzay, derin bir giriş ve kozmik ambient.',
    art: 'linear-gradient(135deg,#05030f 0%,#2a0f55 50%,#d946ef 135%)',
    bundle: { chat_theme: 'soft', bubble_style: 'shadow', profile_theme: 'ocean', name_effect: 'gradient', profile_effect: 'stagelights' },
    sound: 'cosmic',
    hub_theme: 'aurora', hub_effect: 'stars'
  },
  {
    key: 'sakura', label: 'Sakura Garden', emoji: '🌸', tier: 'plus', category: 'included', price_coins: null,
    desc: 'Savrulan yapraklar, yumuşak tellerin sesi.',
    art: 'linear-gradient(135deg,#2a0f22 0%,#7a2e5c 55%,#ffb7d5 135%)',
    bundle: { chat_theme: 'soft', bubble_style: 'round', profile_theme: 'sakura', name_effect: 'gradient', profile_effect: 'sakura' },
    sound: 'garden',
    hub_theme: 'ember', hub_effect: 'petals'
  },
  {
    key: 'cosmic-night', label: 'Cosmic Night', emoji: '🪐', tier: 'coin', category: 'coin', price_coins: 250, purchasable: false,
    desc: 'Cosmic\'in sakin, derin gece versiyonu. Coin ile alınacak (satın alma yakında).',
    art: 'linear-gradient(135deg,#02010a 0%,#1a1245 50%,#7c8cff 135%)',
    bundle: { chat_theme: 'contrast', bubble_style: 'glass', profile_theme: 'midnight', name_effect: 'shimmer', profile_effect: 'stagelights' },
    sound: 'cosmic',
    hub_theme: 'aurora', hub_effect: 'stars'
  }
];

// ── Lobi Takviyesi ───────────────────────────────────────────────────────────────────────────────
// Premium aboneler ayda PREMIUM_MONTHLY_BOOSTS takviye kazanır; takviye bir lobiye verilerek seviyesini yükseltir.
// `at`: bu seviyeye ulaşmak için gereken toplam takviye. `soon: true` = henüz yapılmadı (arayüz "Yakında" gösterir).
const PREMIUM_MONTHLY_BOOSTS = 3;
const HUB_STICKER_SLOTS = 5; // Seviye 4: lobiye özel çıkartma yuvası sayısı
const HUB_EMOJI_SLOTS = 10; // Seviye 4: lobiye özel emoji yuvası sayısı
const BOOST_COOLDOWN_HOURS = 24; // takviyeyi geri çekince o yuva 24 saat boşalmaz (lobiler arası hızlı kaydırmayı önler)
const BOOST_LEVELS = [
  { level: 1, at: 0, title: 'Standart lobi', perks: [] },
  { level: 2, at: 2, title: 'Özel görünüm', perks: [{ text: 'Özel lobi teması' }, { text: 'Özel lobi arka planı' }] },
  { level: 3, at: 7, title: 'Atmosphere', perks: [{ text: 'Lobi Atmosphere + lobi sesi' }, { text: 'Hareketli lobi bannerı (GIF)' }, { text: 'Özel lobi görsel efektleri' }] },
  { level: 4, at: 10, title: 'Gelişmiş lobi', perks: [{ text: 'Lobiye özel emoji yuvaları (10 adet, :isim: ile kullanılır)' }, { text: 'Lobiye özel çıkartma yuvaları (5 adet)' }, { text: 'Gelişmiş sesli oda özellikleri', soon: true }, { text: 'Özel animasyonlar', soon: true }, { text: 'Daha fazla kişiselleştirme', soon: true }, { text: 'Özel lobi içerikleri', soon: true }] }
];
function levelForBoosts(count) {
  let lvl = 1;
  for (const l of BOOST_LEVELS) if (count >= l.at) lvl = l.level;
  return lvl;
}

const SOUND_KEYS = ['cyber', 'midnight', 'cosmic', 'garden'];

function getAtmosphere(key) {
  return ATMOSPHERES.find((a) => a.key === key) || null;
}

module.exports = { ATMOSPHERES, SOUND_KEYS, getAtmosphere, PREMIUM_MONTHLY_BOOSTS, BOOST_COOLDOWN_HOURS, BOOST_LEVELS, levelForBoosts, HUB_EMOJI_SLOTS, HUB_STICKER_SLOTS };
