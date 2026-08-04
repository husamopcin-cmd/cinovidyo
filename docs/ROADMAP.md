# CinoVid AI Studio Yol Haritası

CinoVid, tamamen tarayıcıda çalışan, sunucusuz ve gizlilik odaklı bir video stüdyosu ve araç setidir. Dosyalar internete çıkmaz, tüm işlemler yerel cihazın gücüyle (WebCodecs, Canvas, Web Workers) gerçekleştirilir. Projede Supabase, Remotion, FFmpeg.wasm gibi harici bağımlılıklar ve sunucu taraflı render motorları kullanılmaz.

## Mimari Vizyon: İki Ana Mod

CinoVid tek bir uygulamada iki güçlü mod sunar:

1. **[Stüdyo] (Video Oluşturucu)**
   Kullanıcının yüklediği metin, PDF, görsel veya videodan saniyeler içinde 9:16 dikey (Reels/Shorts/TikTok) formatlı, seslendirmeli ve altyazılı bir video üretir. Timeline editörü, yapay zeka destekli planlayıcı ve sahne yönetimi içerir.

2. **[Araçlar] (Tam Video Araç Seti)**
   Büyük video dosyalarını donanım hızlandırmalı WebCodecs ile tarayıcıda işleyen hızlı yardımcı araçlar (Sıkıştırma, Format Dönüştürme, Kırpma, Ses Çıkarma). İşlemler cihazdan çıkmadan güvenle yapılır.

---

## Faz 0 — Temizlik ve Mimari Doğrulama (Tamamlandı)
- [x] ROADMAP.md güncellenerek yeni 'Stüdyo' ve 'Araçlar' vizyonunun eklenmesi
- [x] Eski veritabanı (Supabase) ve sunucu render bağımlılıklarının projeden tamamen çıkarılması
- [x] IndexedDB, Canvas, MediaRecorder ve WebCodecs tabanlı yeni mimarinin belgelenmesi

## Faz 1 — Transcode Motoru (Tamamlandı)
- [x] Tarayıcı içi donanım hızlandırmalı (WebCodecs) `src/lib/transcode/` motorunun kurulması
- [x] UI donmasını önlemek için işlemlerin Web Worker (`worker.ts`) içerisine taşınması
- [x] RAM sorunlarını çözmek için `BufferTarget` ile stream (akıtarak) yazma mimarisi (Önizleme UX'i için `showSaveFilePicker` devredışı bırakıldı)
- [x] Medya analizi (probe.ts) ve bileşen entegrasyon arayüzü (index.ts)

## Faz 2 — Sıkıştırma Aracı (Tamamlandı)
- [x] `/araclar/sikistir` sayfasının tasarlanması ve Stüdyo UI dili (dark mode, glassmorphism) ile uyumlu hale getirilmesi
- [x] Dosya sürükle-bırak desteği ve anlık medya bilgisi (çözünürlük, süre, codec) analizi kartı
- [x] WhatsApp, Sosyal Medya, E-posta vb. için önceden tanımlanmış sıkıştırma profillerinin (preset) eklenmesi
- [x] İşlem sonrası "Videoyu İndir", "Yeni Dosya", "Stüdyoya Git" UX aksiyon butonlarının eklenmesi

## Faz 3 — Kardeş Araçlar (Tamamlandı)
Transcode motoru altyapısı üzerine inşa edilen yardımcı araçlar tamamlandı:
- [x] Format dönüştürücü (`/araclar/donustur`)
- [x] Görüntü oranı kırpıcı (`/araclar/kirp` - 9:16, 1:1, 16:9)
- [x] Ses ayıklayıcı / Sessizleştirici (`/araclar/ses`)

## Faz 4 — Stüdyo İyileştirmeleri (Tamamlandı)
- [x] Stüdyo export akışının (Canvas + MediaRecorder) tamamen çöpe atılması
- [x] Yeni WebCodecs (mediabunny tabanlı) Deterministik Encoder entegrasyonu (Arka plan sekmelerde dahi donmadan render alabilme)
- [x] Ses ve TTS miksajının `OfflineAudioContext` ile hatasız ve sessizleşmeyecek şekilde motorla bütünleştirilmesi

## Faz 5 — V1 Sonrası Yenilikler (Gelecek Aşama)
- [ ] Araçlardan çıkan (sıkıştırılan/kırpılan) videonun "Stüdyoya Git" butonuna basınca IndexedDB üzerinden otomatik olarak yeni bir proje olarak açılması
- [ ] Tarayıcı içi Whisper.wasm tabanlı otomatik altyazı desteği
- [ ] Daha fazla AI destekli video planlama şablonu
