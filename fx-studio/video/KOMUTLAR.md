# Profil giriş videosu — kendi özgün karakterimiz

Profil açılınca bir kez oynayan, 3–4 saniyelik, arka planı saydam animasyon. Uygulamadaki altyapı hazır (`client/fx-video.js`); örnek: **Selam Kedi**.

## Neden yeşil perde?
Yapay zekâ video araçları saydam arka plan veremiyor. Düz **yeşil (#00FF00)** arka planla ürettiririz, yeşili ben silerim. Siyah arka plan işe yaramaz: siyah saç/kıyafet de silinir (önceki anime videosunda olan buydu).

## Kurallar (her komutta)
- Arka plan: **tamamen düz, tek renk, parlak yeşil #00FF00**; gölge, zemin, ışık yansıması yok.
- Karakterde **yeşil renk olmasın** (yeşil göz/kıyafet de silinir).
- Kare (1:1) ya da dikey (9:16); karakter kadrajın **alt yarısında**, üstte boşluk (profil kartında butonların arkasından yükselir).
- 3–4 saniye: 0–0,3 sn boş → karakter alttan girer → selam/hareket → 0,4 sn içinde aşağı çıkar → son kare boş.
- Kamera sabit, kesme yok, yazı/logo yok, sesi önemsiz.
- Özgün karakter: var olan anime/oyun/film karakterine benzemesin.

## Örnek komut (Sora / Runway / Kling / Pika vb.)
```
A short 3.5-second animation of an ORIGINAL cute fantasy character (a small fox spirit with cream fur, orange ear tips and a purple scarf),
2D anime cel-shaded style with clean dark outlines. Fixed camera, no cuts.
Background: completely flat solid pure green #00FF00, no shadows, no floor, no gradients, no lighting on the background.
The character is NOT green anywhere.
Timing: frame starts empty; the fox pops up from the bottom edge, waves one paw cheerfully, small hop, then slides back down out of frame; last frame empty.
Square 1:1 format, character occupies the lower half of the frame.
```
Karakteri değiştirmek için yalnızca parantez içindeki tarifi değiştir (ör. "a tiny robot with a round head and glowing blue eyes").

## Bitince
1. Videoyu indir, bana "indirdim" de (dosya adı fark etmez).
2. Ben şu komutla çeviririm:
   `bash fx-studio/video/donustur.sh <video> <ad>`
3. Parlaklık zarfını (sakinken soluk, harekette parlak) videonun zamanlamasına göre ayarlar, uygulamaya eklerim.
