# CinoVidyo Güvenlik Kuralları

- API anahtarı kaynak koda yazılmaz, loglanmaz, ekrana basılmaz.
- `.env` commit edilmez; yalnızca boş `.env.example` olur.
- Ücretli sağlayıcı çağrıları (ileriki fazda) yalnızca backend/worker'dan yapılır.
- Dosyalar MIME, boyut ve kullanıcı sahipliği ile Zod şemaları üzerinden doğrulanır.
- Kullanıcı dosyaları public bucket'a konmaz; ileride signed URL kullanılacaktır.
- Render işleri idempotency key taşır (çift tıklama = çift ücret OLMAZ).
- Windows ve özel karakterli dosya yolları (ör. Türkçe karakterler) için `os.tmpdir()` ve Base64 gibi güvenli geçici yöntemler kullanılır.
