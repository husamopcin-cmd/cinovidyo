# CinoVidyo Yol Haritası

CinoVidyo, tamamen tarayıcıda çalışan, sunucusuz ve gizlilik odaklı bir video stüdyosu ve araç setidir. Dosyalar internete çıkmaz, tüm işlemler yerel cihazın gücüyle (WebCodecs, Canvas, MediaRecorder) gerçekleştirilir. Projede Supabase, Remotion, FFmpeg.wasm gibi harici bağımlılıklar ve sunucu taraflı render motorları kullanılmaz.

## Mimari Vizyon: İki Ana Mod

CinoVidyo tek bir uygulamada iki güçlü mod sunar:

1. **[Stüdyo] (Video Oluşturucu)**
   Kullanıcının yüklediği metin, PDF, görsel veya videodan saniyeler içinde 9:16 dikey (Reels/Shorts/TikTok) formatlı, seslendirmeli ve altyazılı bir video üretir. Timeline editörü, yapay zeka destekli planlayıcı ve sahne yönetimi içerir.

2. **[Araçlar] (Tam Video Araç Seti)**
   Büyük video dosyalarını donanım hızlandırmalı WebCodecs ile tarayıcıda işleyen hızlı yardımcı araçlar (Sıkıştırma, Format Dönüştürme, Kırpma, Ses Çıkarma).

---

## Faz 0 — Temizlik ve Mimari Doğrulama (Tamamlandı)
- [x] ROADMAP.md güncellenerek yeni 'Stüdyo' ve 'Araçlar' vizyonunun eklenmesi
- [x] Eski veritabanı (Supabase) ve sunucu render bağımlılıklarının projeden tamamen çıkarılması
- [x] IndexedDB, Canvas, MediaRecorder ve WebCodecs tabanlı yeni mimarinin belgelenmesi

## Faz 1 — Transcode Motoru (Aktif Geliştirme)
- [ ] Tarayıcı içi donanım hızlandırmalı (WebCodecs) `src/lib/transcode/` motorunun kurulması
- [ ] UI donmasını önlemek için işlemlerin Web Worker (`worker.ts`) içerisine taşınması
- [ ] `showSaveFilePicker` ile 1GB+ dosyalar için diske stream (akıtarak) yazma desteği, eski cihazlar için Blob fallback
- [ ] Medya analizi (probe.ts) ve bileşen entegrasyon arayüzü (index.ts)

## Faz 2 — Sıkıştırma Aracı (Aktif Geliştirme)
- [ ] `/araclar/sikistir` sayfasının tasarlanması ve Stüdyo UI dili (dark mode, glassmorphism) ile uyumlu hale getirilmesi
- [ ] Dosya sürükle-bırak desteği ve anlık medya bilgisi (çözünürlük, süre, codec) analizi kartı
- [ ] WhatsApp, Sosyal Medya, E-posta vb. için önceden tanımlanmış sıkıştırma profillerinin (preset) eklenmesi
- [ ] Transcode motoru ve Web Worker entegrasyonu ile sıkıştırma işleminin canlı ilerleme barı ile gösterilmesi

## Faz 3 — Kardeş Araçlar (Gelecek Aşama)
Transcode motoru hazır olduktan sonra eklenecek maliyetsiz yan araçlar:
- [ ] Format dönüştürücü (`/araclar/donustur`)
- [ ] Boyut/zaman kırpıcı (`/araclar/kirp`)
- [ ] Ses ayıklayıcı (`/araclar/ses`)

## Faz 4 — Stüdyo İyileştirmeleri (Gelecek Aşama)
- [ ] Stüdyo export akışının (Canvas + MediaRecorder) yeni WebCodecs transcode motoruna bağlanarak daha verimli ve donanım hızlandırmalı hale getirilmesi
- [ ] Gelişmiş tarayıcı uyumluluğu (Safari, Firefox) ve hata yönetimi eklentileri
