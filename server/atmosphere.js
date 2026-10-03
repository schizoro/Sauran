'use strict';

// Sauran Atmosphere = Görsel tema + Ses + Animasyon + Efekt (tek paket). Saf veri; veritabanı/ağ kodu yok.
// Genişletilebilir: yeni paket eklemek = diziye bir nesne eklemek. `category`: included | limited | seasonal | coin.
// tier: 'plus' (Plus ve Premium) | 'premium' (yalnızca Premium). price_coins: ileride Coin ile satış için (null = satılık değil).
// bundle alanları mevcut kişiselleştirme sistemlerinin geçerli değerleridir (db.js ile aynı listeler).
// sound: istemcideki ses motorunun tarif anahtarı (client/atmosphere-audio.js). Yeni lisanslı ses dosyası eklenirse `audio_url` alanı kullanılabilir.

const ATMOSPHERES = [
  {
    key: 'cyber', label: 'Cyber Gaming', emoji: '🎮', tier: 'premium', category: 'included', price_coins: null,
    desc: 'Neon çizgiler, keskin vurgular ve oyuncu enerjisi.',
    art: 'linear-gradient(135deg,#0b1026 0%,#1b0f4a 45%,#00e5ff 130%)',
    bundle: { chat_theme: 'contrast', bubble_style: 'outline', profile_theme: 'midnight', name_effect: 'glow', profile_effect: 'stagelights' },
    sound: 'cyber'
  },
  {
    key: 'midnight', label: 'Midnight Chill', emoji: '🌙', tier: 'plus', category: 'included', price_coins: null,
    desc: 'Koyu gece, yumuşak hareketler ve sakin bir ambient.',
    art: 'linear-gradient(135deg,#06081a 0%,#16224f 55%,#5a4fcf 130%)',
    bundle: { chat_theme: 'soft', bubble_style: 'glass', profile_theme: 'midnight', name_effect: 'shimmer', profile_effect: 'none' },
    sound: 'midnight'
  },
  {
    key: 'cosmic', label: 'Cosmic', emoji: '🌌', tier: 'premium', category: 'included', price_coins: null,
    desc: 'Yavaş akan uzay, derin bir giriş ve kozmik ambient.',
    art: 'linear-gradient(135deg,#05030f 0%,#2a0f55 50%,#d946ef 135%)',
    bundle: { chat_theme: 'soft', bubble_style: 'shadow', profile_theme: 'ocean', name_effect: 'gradient', profile_effect: 'stagelights' },
    sound: 'cosmic'
  },
  {
    key: 'sakura', label: 'Sakura Garden', emoji: '🌸', tier: 'plus', category: 'included', price_coins: null,
    desc: 'Savrulan yapraklar, yumuşak tellerin sesi.',
    art: 'linear-gradient(135deg,#2a0f22 0%,#7a2e5c 55%,#ffb7d5 135%)',
    bundle: { chat_theme: 'soft', bubble_style: 'round', profile_theme: 'sakura', name_effect: 'gradient', profile_effect: 'sakura' },
    sound: 'garden'
  }
];

const SOUND_KEYS = ['cyber', 'midnight', 'cosmic', 'garden'];

function getAtmosphere(key) {
  return ATMOSPHERES.find((a) => a.key === key) || null;
}

module.exports = { ATMOSPHERES, SOUND_KEYS, getAtmosphere };
