# CinoVidyo Mimari (Architecture)

## Bileşenler
- **Web (Next.js)**: Kullanıcı arayüzü, Remotion Player ile canlı önizleme, sürükle-bırak sahne düzenleyici.
- **Worker (Node.js)**: Remotion ve FFmpeg tabanlı render motoru. Kuyruktan iş alır ve MP4 üretir.
- **Shared & Schemas**: Ortak tipler ve Zod doğrulama kuralları.
- **Video Template (Remotion)**: Videonun görsel kompozisyonu.

## Veri Akışı
1. Kullanıcı görselleri ve sesi (veya metni) yükler.
2. Next.js arayüzü Proje objesini JSON tabanlı lokal veritabanına kaydeder.
3. "Video Oluştur" tetiği çalışınca, Worker uygulaması devreye girer.
4. Worker uygulaması, Base64 üzerinden görselleri okuyarak Remotion renderer'ı çalıştırır.
5. MP4 dosyası `./data/outputs` dizinine kaydedilir.

## Adapter Yapısı (Faz 2 Hazırlığı)
- `RenderQueue`: MVP'de lokal `setTimeout` kuyruğu, ileride BullMQ.
- `StorageProvider`: MVP'de lokal `./data/uploads`, ileride Supabase Storage.
- `DatabaseProvider`: MVP'de lokal JSON, ileride Supabase DB.
- `VoiceProvider`: MVP'de sessiz/demo ses, ileride ElevenLabs/Google TTS.
