# CinoVidyo

CinoVidyo; metin, PDF, görsel veya hazır videodan 9:16 dikey video oluşturan
tarayıcı tabanlı bir video stüdyosudur. Sahneler, altyazılar, geçişler ve sesler
editörde düzenlenir; video kullanıcının tarayıcısında gerçek zamanlı üretilir.

**Canlı uygulama:** https://cinovidyo-web.vercel.app

## V1 özellikleri

- Metin, PDF, görsel ve video ile proje başlatma
- Yerel sahne planlama ve Türkçe düzenleme komutları
- Sahne süresi, hareket, geçiş, renk ve altyazı kontrolleri
- Google Cloud veya özel HTTP sağlayıcısıyla sentetik seslendirme
- Mikrofon kaydı, video sesi ve arka plan müziği karıştırma
- Canvas + MediaRecorder ile cihaz üzerinde video üretme
- IndexedDB üzerinde yerel proje ve medya saklama
- Proje yedekleme ve geri yükleme
- Açık/koyu tema ve responsive arayüz

## Kurulum

Gereksinimler: Node.js 20+ ve pnpm 11.

```bash
pnpm install
pnpm dev
```

Web uygulaması varsayılan olarak `http://localhost:3000` adresinde açılır.

## Kalite ve production

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm quality
```

`pnpm quality`; test, TypeScript, ESLint ve production build kontrollerini
tek sırada çalıştırır.

## Ortam değişkenleri

Google Cloud Text-to-Speech:

```text
TTS_PROVIDER=google
TTS_API_KEY=<sunucu tarafında saklanan API anahtarı>
```

Özel TTS uç noktası:

```text
TTS_PROVIDER=custom
TTS_API_URL=https://...
TTS_API_KEY=<isteğe bağlı bearer anahtarı>
```

Secret değerlerini kaynak koda, `.env.example` dosyasına veya istemci tarafına
yazmayın. Production değişkenleri Vercel proje ayarlarında tutulur.

## Video export mimarisi

Uygulama her kareyi 1080×1920 Canvas üzerinde çizer. `captureStream()` ile elde
edilen görüntü; TTS, mikrofon, video ve müzik kaynaklarının Web Audio API ile
karıştırılan sesiyle birleştirilir. MediaRecorder tarayıcının gerçekten
desteklediği ilk formatı seçer. Çıktı, tarayıcı MP4 destekliyorsa `.mp4`;
desteklemiyorsa `.webm` olarak adlandırılır. Sunucuda transcode yapılmaz.

## Veri saklama

Projeler ve yüklenen dosyalar yalnızca kullanılan tarayıcının IndexedDB
deposunda saklanır. Başka cihazda görünmez. Tarayıcı verileri temizlenmeden veya
cihaz değiştirilmeden önce proje listesinden yedek alınmalıdır.

## Destek ve bilinen sınırlar

- Ana hedef güncel masaüstü Chrome ve Edge sürümleridir.
- Gerçek Android Chrome ve Safari kabul testleri tamamlanmadan resmi destek
  verilmez.
- Video üretimi gerçek zamanlıdır; 30 saniyelik çıktı yaklaşık 30 saniye sürer.
- Sekme arka plana alınırsa kayıt, donmuş kare üretmemek için duraklatılır.
- Çıktı formatı ve codec’i tarayıcının MediaRecorder desteğine bağlıdır.
- Büyük PDF ve medya dosyaları cihaz belleği ve tarayıcı kotasıyla sınırlıdır.
- Production TTS için Google Cloud Text-to-Speech API, billing ve güvenli
  environment değişkenleri gerekir.
