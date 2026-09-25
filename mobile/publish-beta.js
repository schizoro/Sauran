// Android beta APK'sını siteye koyar: APK'yı client/downloads/ altına kopyalar, SHA-256 hesaplar ve beta.json üretir.
// Kullanım (Gradle'da assembleRelease sonrası):  node mobile/publish-beta.js <app-release.apk yolu>
// beta.json alanları gelecekteki Play Store geçişi için de kullanılır (playStoreUrl şimdilik boş).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const src = process.argv[2];
if (!src || !fs.existsSync(src)) { console.error('APK yolu gerekli: node mobile/publish-beta.js <apk>'); process.exit(1); }

const gradle = fs.readFileSync(path.join(__dirname, 'android', 'app', 'build.gradle'), 'utf8');
const versionCode = Number((/versionCode\s+(\d+)/.exec(gradle) || [])[1]);
const versionName = (/versionName\s+"([^"]+)"/.exec(gradle) || [])[1];
if (!versionCode || !versionName) { console.error('build.gradle içinde versionCode/versionName okunamadı.'); process.exit(1); }

const outDir = path.join(__dirname, '..', 'client', 'downloads');
fs.mkdirSync(outDir, { recursive: true });
const fileName = `sauran-beta-${versionName}.apk`;
const data = fs.readFileSync(src);
const sha256 = crypto.createHash('sha256').update(data).digest('hex');

// Eski sürüm APK'ları temizlenir (yalnızca güncel sürüm sitede tutulur).
for (const f of fs.readdirSync(outDir)) if (/^sauran-beta-.*\.apk$/.test(f) && f !== fileName) fs.unlinkSync(path.join(outDir, f));
fs.writeFileSync(path.join(outDir, fileName), data);

const meta = {
  packageName: 'online.sauran.app',
  releaseChannel: 'beta',
  currentVersion: versionName,
  versionCode,
  minimumSupportedVersion: versionName,
  fileName,
  downloadUrl: `/downloads/${fileName}`,
  sha256,
  sizeBytes: data.length,
  updatedAt: new Date().toISOString().slice(0, 10),
  playStoreUrl: ''
};
fs.writeFileSync(path.join(outDir, 'beta.json'), JSON.stringify(meta, null, 2) + '\n');
console.log('Yayınlandı:', fileName, `${(data.length / 1048576).toFixed(2)} MB`);
