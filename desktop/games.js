// Windows süreç adı (küçük harf) → oyunun görünen adı. Yalnızca bu listedeki tanınmış oyunlar algılanır;
// süreç listesinin tamamı HİÇBİR ZAMAN sunucuya gönderilmez, yalnızca eşleşen oyun adı iletilir.
const GAMES = {
    'valorant-win64-shipping.exe': 'VALORANT',
    'cs2.exe': 'Counter-Strike 2',
    'csgo.exe': 'Counter-Strike: GO',
    'league of legends.exe': 'League of Legends',
    'leagueclient.exe': null, // istemci açık ama oyun değil
    'dota2.exe': 'Dota 2',
    'fortniteclient-win64-shipping.exe': 'Fortnite',
    'rocketleague.exe': 'Rocket League',
    'gta5.exe': 'Grand Theft Auto V',
    'gtavi.exe': 'Grand Theft Auto VI',
    'minecraft.windows.exe': 'Minecraft',
    'overwatch.exe': 'Overwatch 2',
    'rainbowsix.exe': 'Rainbow Six Siege',
    'rainbowsix_vulkan.exe': 'Rainbow Six Siege',
    'escapefromtarkov.exe': 'Escape from Tarkov',
    'r5apex.exe': 'Apex Legends',
    'tslgame.exe': 'PUBG: BATTLEGROUNDS',
    'genshinimpact.exe': 'Genshin Impact',
    'starrail.exe': 'Honkai: Star Rail',
    'robloxplayerbeta.exe': 'Roblox',
    'fc25.exe': 'EA SPORTS FC 25',
    'fc24.exe': 'EA SPORTS FC 24',
    'fifa23.exe': 'FIFA 23',
    'cyberpunk2077.exe': 'Cyberpunk 2077',
    'witcher3.exe': 'The Witcher 3',
    'eldenring.exe': 'ELDEN RING',
    'warframe.x64.exe': 'Warframe',
    'terraria.exe': 'Terraria',
    'among us.exe': 'Among Us',
    'fallguys_client_game.exe': 'Fall Guys',
    'rustclient.exe': 'Rust',
    'destiny2.exe': 'Destiny 2',
    'diablo iv.exe': 'Diablo IV',
    'wow.exe': 'World of Warcraft',
    'ffxiv_dx11.exe': 'FINAL FANTASY XIV',
    'hearthstone.exe': 'Hearthstone',
    'osu!.exe': 'osu!',
    'stardew valley.exe': 'Stardew Valley',
    'hollow_knight.exe': 'Hollow Knight',
    'deadbydaylight-win64-shipping.exe': 'Dead by Daylight',
    'helldivers2.exe': 'HELLDIVERS 2',
    'paladins.exe': 'Paladins',
    'brawlhalla.exe': 'Brawlhalla',
    'tekken8.exe': 'TEKKEN 8',
    'valheim.exe': 'Valheim',
    'left4dead2.exe': 'Left 4 Dead 2',
    'hl2.exe': 'Half-Life 2',
    'pathofexile_x64steam.exe': 'Path of Exile',
    'mobilelegends.exe': 'Mobile Legends'
};

// tasklist çıktısından gelen süreç adları arasında bilinen bir oyun varsa adını döndürür, yoksa null.
function detectGame(imageNames) {
    for (const raw of imageNames) {
        const name = GAMES[String(raw).toLowerCase()];
        if (name) return name;
    }
    return null;
}

// `tasklist /FO CSV /NH` çıktısı: "Image Name","PID","Session Name",...  → süreç adları dizisi.
function parseTasklist(csv) {
    const names = [];
    for (const line of String(csv).split(/\r?\n/)) {
        const m = /^"([^"]+)"/.exec(line.trim());
        if (m) names.push(m[1]);
    }
    return names;
}

module.exports = { GAMES, detectGame, parseTasklist };
