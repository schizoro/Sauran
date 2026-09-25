# Gerçek cihaz test planı (elle uygulanır)

> Bu ortamdan **yapılamayan** testlerdir; sahte başarı iddia edilmez. Her maddeyi işaretleyip sonucu kaydedin. Üretim verisiyle değil, **test hesaplarıyla** yapın.

## Ön koşul
Tüm yapılandırma `node server/preflight.js` ile HATA'sız; test hesapları: A (bildirim alan), B (gönderen), C (18 yaş altı hesap), sesli oda için bir lobi.

## Android uygulaması (Capacitor kabuğu)
- [ ] Uygulama `https://sauran.onrender.com` açar; giriş sonrası oturum yenilemeden sonra da sürer.
- [ ] Uygulama kapalıyken B'den A'ya DM → bildirim gelir; metni **"Yeni mesajınız var"** (içerik/ad YOK); dokununca uygulama açılır ve **mesaj/arkadaş listesi** ekranı görünür.
- [ ] Lobi mesajı, gelen arama, arkadaşlık isteği, lobi daveti bildirimleri de yalnızca **genel metin** taşır.
- [ ] Çıkışta cihaz anahtarı silinir (`fcm_tokens` kaydı kalkar).
- [ ] Sesli oda: ön plan servisi çalışır; mikrofon izni; Daily'de kullanıcı adı **görünmez** (katılımcı adı "Sauran").

## iPhone / iPad (PWA "Ana ekrana ekle")
- [ ] Web Push aboneliği (iOS 16.4+ gerekir): izin isteği yalnızca kullanıcı hareketiyle; bildirim metni genel.
- [ ] Bildirime dokununca PWA açılır ve **tür bazlı genel ekran** görünür (bildirim paneli / arkadaş listesi).
- [ ] Uygulama arka plandayken push gelir; ön plandayken yinelenen sistem bildirimi yoktur.
- [ ] Ses: iOS otomatik oynatma kısıtı — sesli odada "sesi etkinleştir" akışı çalışır.

## Masaüstü tarayıcılar (Chrome/Edge/Firefox/Safari)
- [ ] Web Push: sekme kapalı/arka planda iken push; içerik genel; tıklama açık pencereye `open-general`, kapalıysa `?notif_type=` ile açılır; bilinmeyen tür güvenle yok sayılır.
- [ ] Servis işçisi kaydı başarılı (`/sw.js`), aynı türdeki bildirimler `tag=tür` ile birleşir.

## Çocuk hesabı (C)
- [ ] Yabancı hesapta C'nin avatarı/kapağı/biyografisi/çevrimiçi durumu **görünmez**; arkadaşta görünür.
- [ ] Yabancı C'ye DM gönderemez; arkadaşlık isteğini C kabul etmeden DM açılmaz.

## Hesap silme ve dışa aktarım
- [ ] Hesap silme şifre ister; silince oturum, soket ve çerez düşer; karşı taraf "Silinmiş hesap" salt okunur sohbetini görür.
- [ ] "Verilerimi İndir" JSON'unda tam doğum tarihi yoktur; `age_group` vardır.

## Kayıt akışı
- [ ] Kayıtlı e-postayla kayıt: aynı "kod gönderildi" yanıtı; adrese kod içermeyen bilgi e-postası gider.
- [ ] Yeni parola en az 8 karakter; mevcut kısa parolayla giriş çalışır.

## Sonuç kaydı
Her madde için: cihaz/OS/sürüm, tarih, sonuç, ekran görüntüsü (kişisel veri içermemeli).

## Kapalı beta ek senaryoları (elle uygulanır — bu ortamda YAPILMADI)

### Android (release APK `1.0.0-beta.1`)
- [ ] Temiz kurulum (siteden APK; bilinmeyen kaynak izni); eski debug APK varsa önce kaldır
- [ ] Yeni kayıt (davet kodu ile), e-posta kodu, ilk giriş bildirimi (beta metni)
- [ ] Mevcut hesapla giriş; uygulamayı kapatıp aç → oturum kalıyor mu; çıkış → giriş
- [ ] Bildirim izni; mesaj/DM bildirimi; bildirime dokununca doğru ekran; uygulama arka planda/kilitli
- [ ] DM, lobi, sesli oda: mikrofon izni, mikrofon aç/kapa, kulaklık, Bluetooth, arka plana alma (ön plan servisi), ekran kilidi, Wi-Fi → mobil veri
- [ ] Klavye: mesaj yazarken alan klavyenin üstünde kalıyor mu, sıçrama var mı
- [ ] Ayarlar → Beta geri bildirim gönder; hesap silme; veri dışa aktarma

### iPhone (Safari / ana ekran PWA)
- [ ] Kayıt/giriş; ana ekrana ekle; bildirim izni ve bildirimi; arka plan; klavye; DM; lobi; sesli oda; oturumun kalması

### Web / masaüstü
- [ ] Kayıt (davet kodlu ve kodsuz reddedilme), giriş, DM, lobi, bildirim, sesli oda, rapor → moderasyon, dışa aktarım/silme
- [ ] Founder: `admin.html → Beta` (davet oluştur/iptal, mod, geri bildirim)
