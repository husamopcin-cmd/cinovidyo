# CinoVidyo V1 Mimarisi

## Genel yapı

CinoVidyo, Next.js tabanlı bir web uygulamasıdır. Proje verileri ve medya
dosyaları kullanıcının tarayıcısında tutulur; video da tarayıcı içinde üretilir.
Production dağıtımı Vercel üzerindedir.

## Veri akışı

```text
Metin / PDF / görsel / video
        ↓
Yerel sahne planlayıcı
        ↓
IndexedDB proje + Asset kayıtları
        ↓
Editör ve Canvas önizleme
        ↓
Canvas.captureStream + Web Audio API
        ↓
MediaRecorder
        ↓
MP4 veya WebM Blob → kullanıcı indirmesi
```

## Frontend

- Next.js App Router ve React
- `/`: ürün tanıtımı
- `/new`: kaynak seçimi ve proje oluşturma
- `/projects`: yerel projeler, yedekleme ve geri yükleme
- `/editor/[id]`: sahne düzenleme, önizleme, ses ve export

## Yerel veri

`apps/web/src/lib/store.ts`, IndexedDB üzerinde `projects` ve `assets`
depolarını yönetir. Görsel, video, müzik ve seslendirmeler Blob olarak saklanır.
Yedekleme akışı proje kaydını ve bağlı asset’leri JSON içinde base64 olarak
dışa aktarır. Veriler cihazlar arasında otomatik eşitlenmez.

## Sahne planlama

`apps/web/src/lib/planner.ts`, metni sahnelere böler; süre, hareket, geçiş,
altyazı ve görsel kompozisyon varsayılanlarını üretir. Bu temel akış harici AI
olmadan çalışır. `/api/ai/chat`, anahtar mevcutsa gelişmiş düzenleme için ayrı
bir sunucu uç noktası sağlar.

## Video motoru

`apps/web/src/lib/engine.ts`:

1. Sahne zaman çizelgesini kurar.
2. Her kareyi 1080×1920 Canvas üzerine çizer.
3. Görsel/video sahnelerine hareket ve geçiş uygular.
4. Altyazıları doğrudan karelere işler.
5. Canvas görüntüsünü `captureStream(30)` ile MediaStream’e dönüştürür.
6. MediaRecorder’ın desteklediği gerçek MIME türünü seçer.
7. Sonucu uzantısıyla birlikte Blob olarak döndürür.

Sunucu tarafında FFmpeg transcode yoktur. MP4 desteklenmiyorsa çıktı WebM olur
ve `.webm` uzantısıyla indirilir.

## Ses ve TTS

Ses kaynakları Web Audio API üzerinden ayrı GainNode’larla karıştırılır:

- sahne videolarının kendi sesi
- TTS veya mikrofonla kaydedilmiş sahne seslendirmesi
- arka plan müziği

`/api/tts` iki sağlayıcı biçimini destekler:

- `google`: `TTS_PROVIDER` + `TTS_API_KEY`
- `custom`: `TTS_PROVIDER` + `TTS_API_URL` ve isteğe bağlı `TTS_API_KEY`

Google sağlayıcısı Türkçe standart kadın/erkek sesini MP3 olarak döndürür.
Anahtar yalnızca Vercel sunucu ortamında bulunur. Üretilen ses Blob’u IndexedDB
asset’i olur ve sahnenin `voiceAssetId` alanıyla export motoruna aktarılır.
Tarayıcının SpeechSynthesis önizlemesi export’a girmez.

## Hata davranışı

- TTS yapılandırılmamışsa `/api/tts` açık `503 TTS_NOT_CONFIGURED` döndürür.
- Dış TTS hatası sahte başarıya çevrilmez.
- MediaRecorder desteklenmiyorsa export başlamadan açıklayıcı hata verilir.
- Boş kayıt Blob’u başarılı kabul edilmez.
- Arka plandaki sekmede kayıt duraklatılır.

## Dağıtım ve bağımlılıklar

- Vercel, `apps/web` Next.js uygulamasını dağıtır.
- TTS ve AI anahtarları yalnızca Vercel environment değişkenleridir.
- Render kabiliyeti tarayıcının Canvas, MediaRecorder, Web Audio ve codec
  desteğine bağlıdır.
- Birincil kabul tarayıcıları güncel Chrome ve Edge’dir.
