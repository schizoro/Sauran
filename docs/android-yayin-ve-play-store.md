# Android yayını (beta APK) ve Play Store'a geçiş planı

## 1. Mevcut durum
| Alan | Değer |
|---|---|
| Paket kimliği (`applicationId`) | `online.sauran.app` — **Play Store'a geçişte DEĞİŞMEMELİ** |
| Sürüm | `versionName 1.0.0-beta.1`, `versionCode 2` (`mobile/android/app/build.gradle`) |
| Yapı türü | **release**, `minifyEnabled false`, hata ayıklanabilir DEĞİL (doğrulandı: `aapt2 dump badging`'de `application-debuggable` yok) |
| Hedef | `minSdk 24`, `targetSdk 36` |
| Üretim bağlantısı | `mobile/capacitor.config.json` → `https://sauran.online` (HTTPS; `cleartext:false`; `allowNavigation: sauran.online`). Önceki `sauran.onrender.com` yerine resmi alan adı; **oturum çerezleri alan adına bağlıdır → eski `onrender.com` üzerinden giriş yapmış kullanıcılar bir kez yeniden giriş yapar.** |
| İzinler | INTERNET, ACCESS_NETWORK_STATE, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS, FOREGROUND_SERVICE(+MICROPHONE), POST_NOTIFICATIONS, WAKE_LOCK (+FCM'in eklediği c2dm alma izni). Gereksiz izin yok. |
| İmza | Yayın anahtarı ile imzalı (APK Signature Scheme v2 doğrulandı; `apksigner verify`) |
| SHA-256 | `client/downloads/beta.json` içinde (`sha256`); sitede gösterilir |

## 2. İmza anahtarı (EN ÖNEMLİ)
- Anahtar dosyası **depo dışında** üretildi: `C:\Users\7kmht\sauran-signing\sauran-release.jks` (+ `keystore.properties`). **OneDrive/git dışındadır.**
- Gradle yapılandırması: `SAURAN_KEYSTORE_PROPERTIES` ortam değişkeninin gösterdiği dosyayı okur; dosya yoksa APK **imzasız** çıkar (debug anahtarına asla düşmez).
- **Bu anahtarı ve parolayı KAYBEDERSENİZ mevcut kullanıcılar uygulamayı güncelleyemez** (yeni imza = farklı uygulama). Klasörü parola yöneticisi / şifreli yedeğe alın (`BUNU-YEDEKLE.txt`).
- Git'e girmeyenler: `*.jks`, `*.keystore`, `mobile/android/keystore.properties` (`.gitignore`).
- Geçmişte kullanılan **debug imzalı APK**'yı kurmuş cihazlarda bu release APK doğrudan güncellenmez (imza farkı): önce eski uygulamayı kaldırıp yeniden kurmak gerekir.

## 3. Yeni sürüm üretme
```bash
cd mobile && npx cap sync android            # web ayarlarını kopyalar
cd android
# JAVA_HOME (JDK 21), ANDROID_HOME ve SAURAN_KEYSTORE_PROPERTIES ayarlı olmalı
./gradlew assembleRelease
node ../publish-beta.js <app-release.apk>    # client/downloads/ + beta.json (SHA-256) günceller
```
Sürüm yükseltirken **`versionCode`'u mutlaka artırın** (Play Store ve güncellemeler için tek yönlü artan olmalı).

## 4. Site dağıtımı
- `sauran.online` ana sayfasında "Sauran Android Beta" bölümü: sürüm, boyut, tarih, SHA-256 (`/downloads/beta.json`'dan okunur) ve indirme düğmesi.
- APK `client/downloads/` altında (yaklaşık 4,3 MB) repoda ve Render'dan HTTPS ile sunulur; `Content-Disposition: attachment`, `application/vnd.android.package-archive`, `nosniff`. Yalnızca güncel sürüm tutulur (eski APK silinir).
- **Repoya ikili dosya eklemenin bedeli:** her sürüm git geçmişine ~4 MB ekler. Beta için kabul edilebilir; sürüm sayısı artarsa harici depoya (ör. R2) taşınıp `downloadUrl` değiştirilebilir.

## 5. Play Store'a geçiş planı (henüz YAPILMADI)
Akış: **Site APK → Google Play → siteden APK bağlantısını kaldırma → Play'e yönlendirme.**
1. **Değiştirilmemesi gerekenler:** `applicationId` (`online.sauran.app`), imza stratejisi (Play App Signing kullanılacaksa mevcut anahtar **upload key/legacy key** olarak yüklenir; kayıtta anahtarın kendisi Play'e devredilebilir — bu karar Play kaydı sırasında verilir), `versionCode` sırası.
2. **Sürüm planı:** Play'e ilk yüklenen sürümün `versionCode`'u, sitedeki en yüksek `versionCode`'dan **büyük** olmalı.
3. **Play öncesi kontroller (kod dışı):** Play Console hesabı, gizlilik politikası URL'si, **Veri güvenliği (Data safety) formu**, içerik derecelendirmesi, **hedef kitle/çocuk politikası**, hesap silme URL'si/uygulama içi hesap silme beyanı, `RECORD_AUDIO`/ön plan servisi izin açıklamaları, `targetSdk` gerekliliği. Bunlar **hukuki/politika incelemesi** ister.
4. **Eski APK kullanıcıları:** cihazlarındaki uygulama silinmez. Play'e geçince `client/downloads/beta.json` içindeki `playStoreUrl` doldurulur, `minimumSupportedVersion` yükseltilebilir; uygulama içi bir bildirim/banner ile Play'e yönlendirme ileride bu alanlardan beslenebilir (şimdilik yalnızca **yapılandırma noktası** hazır; güncelleme sistemi geliştirilmedi).
5. **Site APK bağlantısının kapatılması:** `landing.html` içindeki `#android-beta` bölümünü Play düğmesiyle değiştirin; `client/downloads/*.apk` dosyasını kaldırın; `beta.json` kalabilir (`playStoreUrl`).
6. `beta.json` alanları: `packageName`, `releaseChannel`, `currentVersion`, `versionCode`, `minimumSupportedVersion`, `downloadUrl`, `sha256`, `sizeBytes`, `updatedAt`, `playStoreUrl`.

## 6. Doğrulanmayanlar
- **Gerçek Android cihaz testi YAPILMADI** (bu ortamda cihaz yok). Yalnızca APK statik denetimi (paket, sürüm, imza, izinler, release/debug, URL) yapıldı. Test paketi: `docs/gercek-cihaz-test-plani.md`.
- Klavye düzeltmesi (`windowSoftInputMode=adjustResize`) bu APK'da mevcuttur; gerçek cihazda doğrulanmadı.
- FCM bildirimi ve bildirime dokununca uygulamaya dönüş gerçek cihazda test edilmedi.
