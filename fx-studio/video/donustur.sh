#!/usr/bin/env bash
# Yeşil perde (chroma key) videosunu profil giriş efektine çevirir.
# Kullanım:  bash fx-studio/video/donustur.sh <giriş_videosu> <ad>  [renk=0x00FF00] [benzerlik=0.30]
# Örnek:     bash fx-studio/video/donustur.sh ~/Downloads/karakter.mp4 gece-kahramani
# Çıktı (client/fx/):  <ad>.webm (saydam VP9, Chrome/Android/masaüstü)  <ad>.webp (hareketli, iPhone/Safari)  <ad>-poster.webp (mağaza küçük resmi)
# Sonra: client/fx-video.js VIDEOS'a kayıt ekle (süre, boyut, parlaklık zarfı) + server/db.js PROFILE_EFFECTS + seçici düğmesi.
set -euo pipefail
if [ $# -lt 2 ]; then echo "Kullanım: bash fx-studio/video/donustur.sh <giriş_videosu> <ad> [renk] [benzerlik]"; exit 1; fi
IN="$1"; NAME="$2"; KEY="${3:-0x00FF00}"; SIM="${4:-0.30}"
[ -f "$IN" ] || { echo "Video bulunamadı: $IN"; exit 1; }
[[ "$NAME" =~ ^[a-z0-9-]+$ ]] || { echo "Ad yalnızca küçük harf, rakam ve tire olmalı: $NAME"; exit 1; }
OUT="$(cd "$(dirname "$0")/../.." && pwd)/client/fx"
[ -d "$OUT" ] || { echo "Klasör yok: $OUT"; exit 1; }
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN")
[[ "$DUR" =~ ^[0-9.]+$ ]] || { echo "Video süresi okunamadı ($DUR)"; exit 1; }
FPS=12; SIZE=480
# 1) Yeşili sil, kenardaki yeşil yansımayı temizle (despill), kare yap (kenarlar saydam), 12 fps
KEYF="fps=${FPS},chromakey=${KEY}:${SIM}:0.08,despill=type=green:mix=0.6:expand=0.1,scale=${SIZE}:${SIZE}:force_original_aspect_ratio=decrease,pad=${SIZE}:${SIZE}:(ow-iw)/2:(oh-ih)/2:color=0x00000000,format=yuva420p"
ffmpeg -v error -y -i "$IN" -an -vf "$KEYF" -c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 -b:v 0 -crf 34 -deadline good "$OUT/$NAME.webm"
ffmpeg -v error -y -i "$IN" -an -vf "${KEYF},scale=360:360" -c:v libwebp_anim -q:v 75 -compression_level 6 -loop 1 -pix_fmt yuva420p "$OUT/$NAME.webp"
MID=$(awk "BEGIN{print $DUR*0.4}")
ffmpeg -v error -y -ss "$MID" -i "$IN" -frames:v 1 -vf "${KEYF},scale=240:240" -c:v libwebp -quality 80 "$OUT/$NAME-poster.webp"
ls -l "$OUT/$NAME".webm "$OUT/$NAME".webp "$OUT/$NAME"-poster.webp
echo "Süre: ${DUR} sn — fx-video.js kaydında dur değeri olarak kullan."
