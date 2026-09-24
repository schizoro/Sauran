# Kimlik doğrulama / hesap güvenliği notları (Aşama 16)

Bu belge, oturum-açma/kayıt/şifre sıfırlama/hesap silme akışlarındaki **teknik** güvenlik kararlarını özetler. Hukuki bir uyumluluk beyanı değildir.

## Kullanıcı numaralandırma (enumeration) önlemleri

| Akış | Önlem |
|---|---|
| Giriş | Var olan ve olmayan hesap için aynı durum/mesaj; hesap yoksa (ya da parola özeti yoksa) yine de sahte scrypt doğrulaması yapılır (zamanlama farkı yok). Askı bilgisi yalnızca parola doğrulandıktan sonra verilir. |
| Kayıt | E-posta zaten kayıtlıysa istemciye **aynı başarı yanıtı** döner; doğrulama kaydı oluşmaz, adrese kod içermeyen "bu e-postayla hesabın zaten var" bilgi e-postası gider. E-posta gönderimi yanıtı **beklemez**. (Kullanıcı adı müsaitliği bilinçli olarak gösterilir: kullanıcı adları uygulamada zaten herkese görünür.) |
| Şifre sıfırlama isteği | Kayıtlı/kayıtsız e-posta için aynı yanıt ve benzer maliyet; e-posta gönderimi yanıtı beklemez. |
| Şifre sıfırlama onayı | Hesap yok / istek yok / yanlış kod / süresi dolmuş / deneme aşıldı → tek genel hata (`Geçersiz veya süresi dolmuş kod.`). |

## Parola politikası

* Yeni parolalar (kayıt, sıfırlama, değiştirme): **en az 8, en çok 128** karakter. Önceki alt sınır 6'ydı.
* **Mevcut hesaplar etkilenmez**: girişte parola uzunluğu şartı aranmaz; eski kısa parolalar çalışmaya devam eder (kullanıcı şifre değiştirirken yeni politika uygulanır).
* Giriş uçlarında uzunluk üst sınırları (kullanıcı adı/e-posta 254, parola 1024) ucuz reddedilir.

## Oturum / soket / hesap silme

* Her soket, doğrulandığı **oturuma bağlıdır**. Çıkış, tek oturum iptali, "tümünden çık", şifre değişimi ve şifre sıfırlaması sonrası ilgili sokettler kapatılır;
  ayrıca 5 dakikada bir tüm açık soketlerin oturumu denetlenir (süresi dolan/silinen oturumun soketi kapanır).
* **Hesap silme parola ile yeniden doğrulanır** (`DELETE /api/account` gövdesinde `password`): çalınmış/açık kalmış bir oturumla kalıcı silme engellenir.
  Parolası olmayan (eski) hesaplar için doğrulama atlanır. Silme sonrası oturumlar, soketler ve çerez temizliği önceki davranışla aynıdır.
* Hız sınırları (bellek içi, IP başına): giriş 8/5 dk (IP+kullanıcı), kayıt 5/15 dk, doğrulama/sıfırlama onayı 30/10 dk + 10/10 dk, sıfırlama isteği 5/15 dk,
  **şifre değiştirme 10/15 dk (yeni)**, **hesap silme 5/15 dk (yeni)**.

## Bilinen sınırlar / dış doğrulama

* Hız sınırları süreç belleğindedir (yeniden başlatmada sıfırlanır; çok örnekli ölçeklemede paylaşılmaz).
* Hesap başına (IP'den bağımsız) kilitleme bilinçli olarak eklenmedi: bir saldırganın meşru kullanıcıyı kilitlemesine (DoS) yol açar.
* E-posta teslimatı/spam davranışı e-posta sağlayıcısına bağlıdır (bkz. üçüncü taraf belgesi).
