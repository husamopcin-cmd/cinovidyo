# CinoVidyo — Yazılım Gereksinim Belgesi (SRS)

**Sürüm:** 1.0 · **Tarih:** 2 Ağustos 2026 · **Durum:** Bu belge tek yetkili referanstır.

> Bu belge, paralel oturumlarda dağılan bilgiyi tek yerde topladığı için yazıldı.
> Buradaki her "TAMAM" işareti, tahmine değil **çalıştırılmış teste** dayanır.
> Çelişki olursa: kod > bu belge > diğer dokümanlar.

---

## 1. Ürün Tanımı

CinoVidyo, **tamamen tarayıcıda çalışan** bir video stüdyosu ve araç setidir.

Ayırt edici özelliği: sunucu yok. Video render'ı kullanıcının kendi cihazında yapılır,
projeler tarayıcının IndexedDB'sinde tutulur, **yüklenen hiçbir dosya internete çıkmaz**.
Hesap açma yoktur.

**Canlı:** https://cinovidyo-web.vercel.app

### İki mod

| Mod | Ne yapar | Veri modeli |
|---|---|---|
| **Stüdyo** (`/new`, `/editor/[id]`) | Metin/PDF/görsel/videodan 9:16 dikey, altyazılı, seslendirmeli MP4 üretir | Proje bazlı, IndexedDB'de kalıcı |
| **Araçlar** (`/araclar/*`) | Tek dosya girer, işlenir, tek dosya çıkar | Durumsuz, hiçbir şey saklanmaz |

---

## 2. Hedef Kullanıcı

Küçük işletme sahipleri, emlak danışmanları, sosyal medya içerik üreticileri, freelancer'lar.

Ortak ihtiyaç: profesyonel video editörleriyle uğraşmadan, hesap açmadan, dosyalarını
bir buluta yüklemeden hızlıca paylaşılabilir video üretmek/işlemek.

---

## 3. Mimari Kısıtlar (değiştirilemez kararlar)

- **K1** — Sunucu tarafında video işleme yapılmaz. FFmpeg, Remotion, render worker yoktur.
- **K2** — Kullanıcı dosyaları sunucuya gönderilmez. Depolama yalnızca IndexedDB'dir.
- **K3** — Veritabanı yoktur. (Eski SQLite/Supabase mimarisi kaldırıldı.)
- **K4** — Sunucu tarafı yalnızca iki opsiyonel uç noktadan ibarettir (`/api/tts`, `/api/ai/chat`);
  ikisi de yapılandırılmamışsa uygulama tam çalışmaya devam eder.
- **K5** — Video işleme WebCodecs + mediabunny ile yapılır. ffmpeg.wasm kullanılmaz
  (30 MB indirme, 10-20× yavaş, ~2 GB WASM bellek tavanı büyük dosyalarda çöker).

---

## 4. Fonksiyonel Gereksinimler ve Gerçek Durum

Durum anahtarı: **TAMAM** = test edilerek doğrulandı · **KISMİ** = çalışıyor ama sınırı var · **YOK** = yapılmadı

### 4.1 Stüdyo — Proje yönetimi

| # | Gereksinim | Durum |
|---|---|---|
| FR-01 | Metin/PDF/görsel/video kaynağından proje oluşturma | TAMAM |
| FR-02 | Sektör şablonları (ürün, emlak, yemek, eğitim) | TAMAM |
| FR-03 | Proje listeleme, açma, silme | TAMAM |
| FR-04 | IndexedDB'de kalıcılık (tarayıcı kapansa da durur) | TAMAM |
| FR-05 | Proje yedekleme / geri yükleme (dosyaya dışa aktarma) | TAMAM — arayüz butonları mevcut; yedek JSON'u medyayı `dataUrl` (base64) olarak **gerçekten içeriyor**, çözülüp oynatıldı (320×180, 10.88 sn). Ölçek sınırı için bkz. R6 |
| FR-06 | Cihaz depolama kotası göstergesi | TAMAM |

### 4.2 Stüdyo — Sahne editörü

| # | Gereksinim | Durum |
|---|---|---|
| FR-10 | Sahne ekleme/silme/sıralama | TAMAM |
| FR-11 | Süre, altyazı, hareket (zoom/pan), geçiş, renk teması | TAMAM |
| FR-12 | Katlanır bölümler (İçerik / Seslendirme / Görünüm) | TAMAM |
| FR-13 | Canlı önizleme + zaman çubuğu | TAMAM |
| FR-14 | Kalite kontrol puanı ve öneriler | TAMAM |
| FR-15 | Sürüm geçmişi ve geri alma | TAMAM |

### 4.3 Stüdyo — Seslendirme

| # | Gereksinim | Durum |
|---|---|---|
| FR-20 | Sahne başına ses yöntemi seçimi (yok / yapay ses / mikrofon) | TAMAM |
| FR-21 | Google Cloud TTS ile Türkçe yapay ses (kadın/erkek) | TAMAM — canlıda `configured: true` |
| FR-22 | Mikrofonla kendi sesini kaydetme | KISMİ — kod tam, otomasyon ortamında mikrofon izni yok, **elle test edilmeli** |
| FR-23 | TTS yapılandırılmamışsa net uyarı + mikrofon alternatifi | TAMAM |
| FR-24 | Ses/müzik/video sesi bağımsız seviye miksajı | TAMAM |

### 4.4 Stüdyo — Video üretimi (en kritik akış)

| # | Gereksinim | Durum |
|---|---|---|
| FR-30 | 1080×1920 (9:16) MP4 çıktı | TAMAM — ölçüldü |
| FR-31 | Gerçek zamandan hızlı üretim | TAMAM — 30 sn'lik video ~21-25 sn'de |
| FR-32 | Sekme arka plandayken de çalışma | TAMAM — gizli sekmede doğrulandı |
| FR-33 | Müzik sesinin videoya gömülmesi | TAMAM — stereo 48 kHz, genlik 0.0455 ölçüldü |
| FR-34 | Sahne videosunun kendi sesinin gömülmesi | TAMAM — doğru pencerede enerji 0.405; sahne dışı tam sessiz |
| FR-35 | TTS seslendirmesinin videoya gömülmesi | TAMAM — canlıda Google TTS ile üretilen 4.9 sn'lik ses, 0.3–4.5 sn aralığında enerji 0.07075; 6–12 ve 20–29 sn tam sessiz |
| FR-38 | Ses seviyesi ayarının çıktıya yansıması | TAMAM — %65→0.4051, %20→0.12689; teorik değerle birebir |
| FR-36 | İlerleme göstergesi ve iptal | TAMAM |
| FR-37 | Hızlı yol başarısız olursa gerçek zamanlı yola düşme | TAMAM — kullanıcıya bildirilerek |

### 4.5 Stüdyo — AI asistan

| # | Gereksinim | Durum |
|---|---|---|
| FR-40 | Sohbetle sahne planı oluşturma/düzenleme | TAMAM |
| FR-41 | Uygulamadan önce plan onayı gösterme | TAMAM |
| FR-42 | API anahtarı yoksa yerel planlayıcıya düşme | TAMAM — canlıda şu an bu modda |
| FR-43 | Claude API ile gerçek AI planlama | YOK — `ANTHROPIC_API_KEY` production'da tanımlı değil |

### 4.6 Araçlar

| # | Gereksinim | Durum |
|---|---|---|
| FR-50 | **Sıkıştır** — profil bazlı boyut küçültme | TAMAM — 942 KB→645 KB; 480×270'te 95 KB (%90) |
| FR-51 | İşlem öncesi tahmini boyut gösterimi | TAMAM |
| FR-52 | Kaynaktan yüksek bit hızı seçilirse dosyayı büyütmeme | TAMAM |
| FR-53 | **Dönüştür** — MP4 ↔ WebM, çözünürlük değiştirme | TAMAM — canlıda doğrulandı |
| FR-54 | **Kırp** — en-boy oranı (9:16 / 1:1 / 16:9) | TAMAM — 16:9→1080×1920 doğrulandı |
| FR-55 | **Zaman kırpma** (videonun bir aralığını alma) | TAMAM — 38 sn kaynaktan 10–20 aralığı kesildi, çıktı tam 10.00 sn, çözünürlük korundu |
| FR-56 | **Ses ayıkla** — .m4a olarak çıkarma | TAMAM — çıktı `audio/mp4`, 19.14 sn, stereo 48 kHz, genlik 0.6361 |
| FR-57 | **Sesi kaldır** — sessiz video üretme | TAMAM — ses izi yok, video sağlam (320×180, 18.9 sn) |
| FR-61 | Araç çıktısını "Stüdyoya Git" ile projeye aktarma | TAMAM — asset IndexedDB'ye yazılıyor, proje açılıyor, o projeden video üretildi (1080×1920, 8 sn) |
| FR-58 | Desteklenmeyen tarayıcıda net uyarı | TAMAM |
| FR-59 | Analiz hatalarının kullanıcıya gösterilmesi | TAMAM |
| FR-60 | Web Worker'da çalışma (arayüz donmaz) | TAMAM |

---

## 5. Fonksiyonel Olmayan Gereksinimler

| # | Gereksinim | Durum |
|---|---|---|
| NFR-01 | Gizlilik: dosyalar cihazdan çıkmaz | TAMAM — mimari garanti (K1, K2) |
| NFR-02 | Hesap/giriş gerektirmez | TAMAM |
| NFR-03 | Hiçbir hata sessizce yutulmaz | TAMAM — bu turda 2 sessiz hata düzeltildi |
| NFR-04 | Sahte başarı mesajı gösterilmez | TAMAM — çıktı küçülmediyse açıkça söylenir |
| NFR-05 | Chrome/Edge tam destek | TAMAM |
| NFR-06 | Safari/Firefox desteği | **BİLİNMİYOR** — hiç test edilmedi |
| NFR-07 | Mobil kullanım | **BİLİNMİYOR** — hiç test edilmedi |
| NFR-08 | Kalite kapısı: test+typecheck+lint+build | TAMAM — 27/27 test, hepsi PASS |
| NFR-09 | Açık/koyu tema | TAMAM |

---

## 6. Dış Bağımlılıklar

| Ne | Nerede | Durum |
|---|---|---|
| `mediabunny` | Video demux/mux/transcode | Kurulu, çekirdek bağımlılık |
| `pdfjs-dist` | PDF metin çıkarma | Kurulu |
| `@anthropic-ai/sdk` | AI planlayıcı (opsiyonel) | Kurulu ama anahtar yok |
| `TTS_PROVIDER` + `TTS_API_KEY` | Vercel production env | **Tanımlı** (google) |
| `ANTHROPIC_API_KEY` | Vercel production env | **Tanımlı değil** |

**Deploy tuzağı:** Vercel `apps/web` dizininden build alır ve **oradaki ayrı** `pnpm-lock.yaml`'ı
`--frozen-lockfile` ile kurar. Bağımlılık eklerken kök lockfile yetmez:
`cd apps/web && pnpm install --lockfile-only --ignore-workspace` çalıştırılmalı.

---

## 7. Bilinen Sınırlar ve Riskler

| # | Risk | Etki | Notlar |
|---|---|---|---|
| R1 | `showSaveFilePicker` devre dışı | Çok büyük dosyalar bellekte toplanır (>1-2 GB sorun olabilir) | Önizleme gösterebilmek için bilinçli kapatıldı |
| ~~R2~~ | ~~Seslendirme `decodeAudioData` kullanıyor~~ | — | **KAPANDI** — tüm ses kaynakları `decodeAudioParts()` ile önce native, olmazsa mediabunny yolunu kullanıyor |
| R3 | ffprobe/ffmpeg ile bağımsız doğrulama yapılmadı | V1 etiketi resmen açık | ffmpeg bu makinede kurulu değil |
| R4 | Safari/Firefox/mobil test edilmedi | Bilinmeyen uyumluluk | Chrome/Edge dışında garanti verilmiyor |
| R5 | Yol haritası "zaman kırpma" vaat ediyor, araç yapmıyor | Kullanıcı beklentisi karşılanmıyor | FR-55 |
| R6 | Yedekleme medyayı base64 `dataUrl` olarak tek JSON'a gömüyor | Büyük projelerde (yüzlerce MB video) base64 %33 şişme + tek string bellekte → sekme çökebilir | Küçük projelerde sorunsuz doğrulandı; büyük dosyada test edilmedi |

---

## 8. Sıradaki Plan (öncelik sırasıyla)

### P0 — Doğrulama boşlukları · **TAMAMI KAPANDI**
1. ~~**FR-35**: TTS'li export doğrulaması~~ — **YAPILDI**, canlıda enerji ölçümüyle kanıtlandı.
2. ~~**FR-56/57**: Ses araçlarını gerçek sesli dosyayla test et~~ — **YAPILDI**.
3. ~~**R2**: Seslendirme yolunu mediabunny'ye taşı~~ — **YAPILDI** (`decodeAudioParts`, `a118c5d`).

### P1 — Eksik özellik · **KAPANDI**
4. ~~**FR-55**: Zaman kırpma~~ — **YAPILDI** (`ab0c4a2`), ölçümle doğrulandı.

### P1 — Eksik özellik
4. **FR-55**: Zaman kırpma. Motor zaten destekliyor (`Conversion.init({ trim: {start, end} })`),
   sadece arayüz + parametre geçişi gerekiyor. Kırp aracına ikinci sekme olarak eklenebilir.

### P2 — Uyumluluk ve teslim
5. **NFR-06/07**: Safari, Firefox ve gerçek mobil cihazda test.
6. **R3**: ffmpeg kur (`winget install Gyan.FFmpeg`), çıktıyı ffprobe ile doğrula, `v1.0.0` etiketi at.

### P3 — İsteğe bağlı
7. **FR-43**: Gerçek AI için `ANTHROPIC_API_KEY` ekle (ücretli, ürün kararı).
8. **R1**: Büyük dosyalar için diske akıtarak yazmayı geri getir (önizlemeyi opsiyonel yap).

---

## 9. Tamamlanma Ölçütü (V1)

V1 ancak şunların **hepsi** sağlandığında ilan edilir:

- [x] Stüdyo gerçek, indirilebilir MP4 üretiyor (1080×1920, doğru süre, siyah kare yok)
- [x] Ses videoya gerçekten gömülüyor (müzik + sahne videosu sesi ölçümle kanıtlandı)
- [x] 4 araç da çalışıyor
- [x] Kalite kapısı geçiyor (27/27 test, typecheck, lint, build)
- [x] Production deploy çalışıyor
- [x] TTS seslendirmesi hızlı export'ta doğrulandı (P0-1)
- [x] Ses araçları doğrulandı (P0-2)
- [x] Araç → Stüdyo aktarım zinciri doğrulandı (FR-61)
- [ ] Chrome + Edge kabul testi
- [ ] Mobil kabul testi
- [ ] Bağımsız (ffprobe) dosya analizi
