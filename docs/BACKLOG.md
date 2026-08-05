# CinoVidyo — Agile Ürün Backlog'u

**Sürüm:** 1.0 · **Güncelleme:** 2 Ağustos 2026
**İlgili belgeler:** [SRS.md](./SRS.md) (gereksinimler) · [ROADMAP.md](./ROADMAP.md) (fazlar)

> Bu belge **ne yapılacağını ve hangi sırayla** yönetir. SRS *ne olduğunu ve neyin
> doğrulandığını* tutar. Çelişki olursa kod > SRS > bu belge.

---

## Tanımlar

**Definition of Ready (başlanabilir):** Kabul kriterleri yazılı, bağımlılığı çözülmüş,
teknik yolu belli.

**Definition of Done (bitti sayılır):** Aşağıdakilerin **hepsi**:
1. Kod yazıldı ve mevcut mimariye uygun
2. `typecheck` + `lint` + `test` + `build` PASS
3. Tarayıcıda **ölçülerek** doğrulandı (ekran görüntüsü/iddia değil, sayı)
4. Regresyon kontrolü yapıldı
5. Commit + push edildi
6. SRS'teki ilgili gereksinim durumu güncellendi

**Puanlama:** 1 = birkaç satır · 2 = tek dosya · 3 = birkaç dosya · 5 = yeni modül/akış · 8 = riskli/araştırma gerektiren

---

## EPIC 1 — V1 Doğrulama ve Mühürleme
*Amaç: "çalışıyor" iddiasını kanıta bağlamak ve v1.0.0 etiketini atmak.*

| ID | Kullanıcı hikâyesi | Puan | Durum |
|---|---|---|---|
| US-101 | Kullanıcı olarak, TTS seslendirmeli videomun sesinin doğru sahnede ve doğru seviyede çıktığından emin olmak istiyorum | 3 | **SPRINT 1** |
| US-102 | Geliştirici olarak, çıktı MP4'ün codec/süre/stream yapısını bağımsız araçla (ffprobe) doğrulamak istiyorum | 3 | Bloke — ffmpeg kurulu değil |
| US-103 | Kullanıcı olarak, uygulamayı Safari ve Firefox'ta da sorunsuz kullanmak istiyorum | 5 | Backlog |
| US-104 | Kullanıcı olarak, uygulamayı telefonumda kullanmak istiyorum | 5 | Backlog |
| US-105 | Ekip olarak, doğrulanmış sürümü `v1.0.0` ile mühürlemek istiyoruz | 1 | US-101..104'e bağlı |

**US-101 kabul kriterleri**
- TTS ile seslendirilmiş en az 2 sahneli proje oluşturulur
- Hızlı export ile video üretilir (yedek yola düşmeden)
- Çıktının ses enerjisi **seslendirilen sahnenin zaman aralığında** ölçülür → sıfırdan büyük
- Seslendirilmeyen aralıkta enerji ~0
- Konsolda hata yok

---

## EPIC 2 — Araç Setini Tamamlama
*Amaç: yol haritasında vaat edilen ama eksik kalan araç yeteneklerini kapatmak.*

| ID | Kullanıcı hikâyesi | Puan | Durum |
|---|---|---|---|
| US-201 | Kullanıcı olarak, uzun bir videonun **sadece belirli bir zaman aralığını** almak istiyorum | 5 | **SPRINT 1** |
| US-202 | Kullanıcı olarak, çok büyük dosyaları belleğe sığmadan diske akıtarak kaydetmek istiyorum | 5 | Backlog (R1) |
| US-203 | Kullanıcı olarak, yedeğimin büyük projelerde de çalışmasını istiyorum | 5 | Backlog (R6) |

**US-201 kabul kriterleri**
- `/araclar/kirp` sayfasında "Görüntü oranı" ve "Zaman aralığı" olarak iki mod
- Başlangıç/bitiş saniyesi seçilebilir, geçersiz aralık (başlangıç ≥ bitiş) engellenir
- Çıktı süresi seçilen aralığa eşit (±0.5 sn tolerans) — **ölçülerek** doğrulanır
- Çıktı gerçekten açılıyor, siyah kare yok

---

## EPIC 3 — Stüdyo Kurgu Kalitesi
*Amaç: sahne animasyonlarının her sahne türünde tutarlı çalışması.*

| ID | Kullanıcı hikâyesi | Puan | Durum |
|---|---|---|---|
| US-301 | Kullanıcı olarak, seçtiğim animasyonun **metin sahnelerinde de** çalışmasını istiyorum | 3 | **SPRINT 1** |
| US-302 | Kullanıcı olarak, AI asistanın yeni animasyonları da önerebilmesini istiyorum | 2 | Backlog |

**US-301 gerekçesi (bulgu)**
`motionTransform()` yalnızca `drawCover()` içinde çağrılıyor; `drawTextScene()` onu hiç
kullanmıyor. Sonuç: kullanıcı metin sahnesinde "Kamera Sarsıntısı" seçse bile hiçbir şey
olmuyor — **sessiz başarısızlık**, NFR-03'e aykırı.

**Kabul kriterleri**
- Metin sahnesinde animasyon seçilince çıktıda görsel değişim ölçülebilir
- Ya animasyon çalışır, ya da desteklenmiyorsa arayüz bunu açıkça söyler

---

## EPIC 4 — V1 Sonrası Özellikler
*V1 mühürlenmeden başlanmaz.*

| ID | Kullanıcı hikâyesi | Puan | Durum |
|---|---|---|---|
| US-401 | Kullanıcı olarak, videomun altyazısının otomatik çıkarılmasını istiyorum (Whisper.wasm) | 8 | Backlog |
| US-402 | Kullanıcı olarak, gerçek AI planlayıcıyı kullanmak istiyorum (`ANTHROPIC_API_KEY`) | 2 | Ürün kararı (ücretli) |
| US-403 | Kullanıcı olarak, daha fazla premium geçiş/animasyon istiyorum | 3 | Backlog |

---

## SPRINT 1 (aktif)

**Sprint hedefi:** V1'in son doğrulama boşluğunu kapatmak ve araç setindeki gerçek eksiği
(zaman kırpma) tamamlamak.

| ID | İş | Puan |
|---|---|---|
| US-101 | TTS'li export doğrulaması | 3 |
| US-201 | Zaman aralığı kırpma | 5 |
| US-301 | Metin sahnesinde animasyon | 3 |

**Toplam:** 11 puan

**Sprint dışı bırakılanlar ve nedeni:**
- US-102 (ffprobe): ffmpeg kurulu değil → dış engel
- US-103/104 (Safari/mobil): bu ortamda o tarayıcılar yok → elle test gerekir
- EPIC 4: V1 kapanmadan başlanmaz
