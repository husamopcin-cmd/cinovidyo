# CinoVid Product Spec v2

Durum: Taslak
Tarih: 2026-07-13
Urun adi: CinoVid
Kod/proje adi: CinoVidyo

## 1. Urun Ozeti

CinoVid, gorsellerden video ureten ve kullanicinin video uretim surecini chat tabanli, sablon destekli ve geri alinabilir bir akisa ceviren yapay zeka destekli video studyosudur.

Urunun ana vaadi: teknik video editor bilmeyen bir kullanici, elindeki gorselleri yukler, hazir komutlardan veya chat'ten ne istedigini soyler, CinoVid once bir plan gosterir, sonra gercek bir MP4 render uretir.

Uzun vadeli vizyon; ozetleme, ceviri, ses ayirma, konusmaci analizi ve mevcut videodan yeniden kurgu gibi agir AI video islemlerine dogru genisleyebilir. Ancak Sürüm 1 bu vizyonun tamamini degil, dogrulanmis render temeli uzerindeki en dar satilabilir urunu hedefler.

## 2. Marka ve Konumlandirma

Birincil marka onerisi: CinoVid.

CinoVid, Cino markasini korur ve urunu yalnizca kisa kliplerle sinirlamaz. "Vid" kismi hem sosyal medya videolarina hem de ileride daha uzun video is akislari icin yeterince genis kalir.

Alternatifler:
- CinoClip: Kisa klip hissi guclu, ama urunu daraltabilir.
- CinoFlow: Akis ve editor hissi iyi, video kategorisini daha dolayli anlatir.
- CinoNova: Daha buyuk ve markamsi, ama urunun ne yaptigini daha az aciklar.

Bu dokuman boyunca urun adi CinoVid, mevcut repo/proje adi CinoVidyo olarak kullanilir.

## 3. Hedef Kullanici

Birincil kullanicilar:
- Kucuk isletme sahipleri
- Emlak danismanlari
- Sosyal medya icerik ureticileri
- Dugun/fotograf/video hizmeti veren freelancer'lar
- Restoran, kafe ve lokal marka sahipleri
- Urun tanitimi yapmak isteyen e-ticaret saticilari

Bu kullanicilarin ortak sorunu profesyonel editor arayuzleriyle ugrasmak istememeleri, bos chat kutusuna ne yazacaklarini bilememeleri ve deneme yaparken geri donulemez hata yapmaktan korkmalaridir.

## 4. Ana Problem

Mevcut video araclari iki uca ayriliyor:
- Klasik editorler guclu ama karmasik.
- AI araclari kolay ama kullaniciya ne yapacagini soyletmekte zayif, bekleme suresini belirsiz birakir ve geri alma guvencesi vermez.

CinoVid'in cozmesi gereken ana problem: kullanicinin elindeki gorsellerden, amacina uygun, dikey, paylasilabilir ve gercekten indirilebilir MP4 videoyu en az karar yorgunluguyla uretmek.

## 5. Urun Prensipleri

- Once gercek render, sonra zeka: Siyah video, sahte kanit veya mock render kabul edilmez.
- Chat tek giris noktasi degil: Hazir komutlar ve sektor sablonlari bos sayfa korkusunu azaltir.
- Uygulamadan once plan: AI islemi yapmadan once sahne plani, sure ve tahmini bekleme gosterilir.
- Her islem geri alinabilir olmali: Kullanicinin deneme cesareti surum gecmisiyle korunur.
- Proje hafizasi vardir: Ayni proje icindeki chat gecmisi ve onceki talimatlar korunur.
- Sürüm 1 kucuk ama gercek olmali: Mock UI yerine calisan editor state, timeline ve render gerekir.

## 6. Sürüm 1 Kapsami

Sürüm 1'in hedefi: kullanici gorsel yuklesin, sektor veya hazir komut secsin, sahne/timeline duzenlesin, onizlesin ve gercek MP4 uretsin.

Sürüm 1 ozellikleri:
- Proje olusturma ve proje listesi
- Gorsel yukleme
- 9:16 dikey video uretimi
- Sahne listesi ve basit timeline
- Sahne sirasi degistirme
- Sahne suresi degistirme
- Baslik/altyazi metni ekleme
- Basit hareket efektleri: zoom in, zoom out, pan left, pan right
- Gercek Remotion MP4 render
- Render durumlari: pending, rendering, completed, failed
- Render oncesi plan ekrani
- Tahmini islem suresi gosterimi
- Hazir komut butonlari
- Sektore ozel baslangic sablonlari
- Proje bazli chat gecmisi
- Tek tik geri al ve temel surum gecmisi
- Render kanitlari icin metadata/log uretimi

Sürüm 1'de olmamasi gerekenler:
- Mevcut videodan otomatik ozetleme
- Video cevirisi/dublaj
- Ses ayirma veya muzik koruma
- Konusmaci ayristirma
- Lip-sync
- Avatar
- Ses klonlama
- Cok katmanli profesyonel timeline
- Bulut odeme/abonelik
- Cok kullanicili ekip sistemi
- Mobil uygulama

## 7. Sürüm 1 Kullanici Akisi

1. Kullanici yeni proje acar.
2. Sektor sablonu secer veya bos baslar.
3. Gorselleri yukler.
4. Hazir komutlardan birine tiklar ya da chat'e kendi istegini yazar.
5. CinoVid bir video plani gosterir:
   - Sahne sirasi
   - Her sahnenin suresi
   - Metin/altyazi onerisi
   - Hareket efekti
   - Tahmini render suresi
6. Kullanici plani uygular.
7. Editor/timeline state guncellenir.
8. Kullanici onizleme yapar.
9. Kullanici render baslatir.
10. Sistem gercek MP4 uretir.
11. Kullanici begenmezse onceki surume doner veya chat ile revize eder.

## 8. Hazir Komut Sablonlari

Hazir komutlar chat kutusunun yaninda veya ustunde gorunur. Tiklaninca prompt chat'e otomatik dolar, kullanici isterse degistirir.

Sürüm 1 komutlari:
- Bu gorsellerden urun reklami yap
- Bu gorsellerden emlak ilani videosu yap
- Bu gorsellerden dugun hikayesi videosu yap
- Bu gorsellerden yemek tarifi videosu yap
- Daha hizli ve enerjik hale getir
- Daha premium ve sakin hale getir
- En iyi 15 saniyelik versiyonu hazirla

Sürüm 1 disi komutlar, UI'da kilitli veya "yakinda" olarak tutulabilir:
- Bu videonun sesini kaldir, muzigi koru
- En onemli 3 dakikayi cikar
- Bu videoyu Turkce altyazili yap
- Iki konusmaciyi ayir

## 9. Sektore Ozel Sablonlar

Sürüm 1 sablonlari:

Emlak ilani:
- Dis cephe veya ana gorsel
- Salon/ana alan
- Mutfak
- Yatak odasi veya detay
- Fiyat/iletisim kapanis sahnesi

Urun tanitimi:
- Urun hero sahnesi
- Problem/vaat
- Ozellikler
- Kullanim senaryosu
- Satin alma/iletisim kapanisi

Dugun:
- Cift hero sahnesi
- Hazirlik/detay
- Tören/ana an
- Kutlama
- Duygusal kapanis

Yemek tarifi:
- Son urun
- Malzemeler
- Hazirlik
- Pisirme/sunum
- Kapanis/cagri

Her sablon sahne sayisi, sahne sirasi, default sure, default metin tonu ve hareket efekti onerisi tasir.

## 10. Proje Hafizasi

Her proje kendi chat gecmisine sahip olur. Kullanici "az once dedigim gibi ama biraz daha hizli yap" dediginde sistem ayni proje icindeki onceki talimatlari kullanir.

Sürüm 1 hafiza kapsami:
- Proje icindeki chat mesajlari
- Uygulanan planlar
- Mevcut timeline state
- Son render sonucu
- Sablon secimi
- Ton tercihi: enerjik, premium, sade, duygusal

Sürüm 1'de global kullanici hafizasi yoktur. Hafiza proje bazlidir.

## 11. Uygula Oncesi Plan ve Tahmini Sure

AI veya otomatik duzenleme islemi dogrudan timeline'i degistirmez. Once plan gosterir.

Plan ekraninda:
- Yapilacak degisiklikler
- Etkilenecek sahne sayisi
- Tahmini video suresi
- Tahmini islem suresi
- Geri alinabilirlik bilgisi

Ornek:
"Bu islem 5 sahneyi guncelleyecek, tahmini video suresi 15 saniye olacak. Render yaklasik 1-2 dakika surebilir."

## 12. Geri Al ve Surum Gecmisi

Her uygulanan AI plani yeni bir proje surumu olusturur.

Sürüm 1 minimum gereksinim:
- Son degisikligi geri al
- Onceki surume don
- Surum listesinde tarih/saat ve kisa aciklama goster
- Render sonucu hangi proje surumunden uretildi bilgisi

Surum gecmisi olmadan ozetleme, otomatik kirpma veya toplu sahne degisikligi gibi islemler kullanici guvenini dusurur. Bu yuzden Sürüm 1'de basit de olsa yer almalidir.

## 13. Konusmaci Tutarlilik Uyarisi

Bu ozellik Sürüm 1 kapsaminda tam uygulanmayacak, ancak urun vizyonunda tutulacak.

Gelecek faz davranisi:
- Sistem mevcut videoda birden fazla konusmaci tespit ederse kullaniciya sorar.
- "Bu videoda 2 farkli ses var. Hangisini anlatici kabul edeyim?"
- Transkript bazli kesme, ozetleme veya dublaj islemleri bu secimden sonra yapilir.

Sürüm 1 notu: Sürüm 1 gorselden video urettigi icin konusmaci analizi gerekli degildir.

## 14. Veri Modeli Taslagi

Project:
- id
- name
- createdAt
- updatedAt
- selectedTemplate
- tone
- currentVersionId

Scene:
- id
- assetId
- order
- durationInFrames
- caption
- motion

Asset:
- id
- projectId
- type
- path
- width
- height
- duration
- createdAt

ChatMessage:
- id
- projectId
- role
- content
- createdAt

ProjectVersion:
- id
- projectId
- label
- timelineSnapshot
- chatMessageId
- createdAt

RenderJob:
- id
- projectId
- versionId
- status
- outputPath
- metadataPath
- errorMessage
- createdAt
- completedAt

## 15. Mimari Yaklasim

Sürüm 1 lokal ve dogrulanabilir olmalidir.

Oncelikli mimari:
- Web: Next.js editor arayuzu
- Worker: Node.js + Remotion render
- Video template: Remotion composition
- Shared schemas: Zod dogrulama
- Storage: Lokal `data/uploads`, `data/test-assets`, `data/outputs`
- DB: Basit JSON veya lokal dosya tabanli proje store

Render prensipleri:
- Gercek dosya asset'leri kullanilir.
- Base64 placeholder veya 1x1 test gorseli kullanilmaz.
- Sabit 900 frame kompozisyon olmaz; toplam sure sahnelerden hesaplanir.
- Ses yoksa render video-only cikabilir; sahte sessiz audio stream zorunlu degildir.
- Output dosyalari benzersiz isimlenir.
- Render kaniti ffprobe metadata ve MP4'ten cikarilan frame'lerle dogrulanabilir.

## 16. Mevcut Kod Gerceklik Notu

Mevcut kod tabani temiz bir Sürüm 1 urunu degildir. Tur 5A render temeli Codex Desktop ortaminda dogrulanmis olsa da repo hala erken ve daginik durumdadir.

Bilinen riskler:
- Repo commitsiz ve dosyalar untracked durumda.
- `dist` icinde stale compiled eski Base64/output.mp4 izleri bulunabilir.
- Web render API tarafinda eski mock/output.mp4 akisi bulunabilir.
- Eski dokumanlarda Base64 tabanli render anlatimi kalmis olabilir.
- Editor sayfasi gercek state/timeline urunu seviyesinde olmayabilir.

Bu nedenle Tur 5B'ye baslamadan once render temelinin yaninda su temizlik yapilmalidir:
- Stale `dist` temizligi veya build stratejisinin netlestirilmesi
- Web mock render API'nin gercek worker/render job akisiyle degistirilmesi
- Dokumanlarin Base64/mock anlatimlarindan arindirilmasi
- Ilk git commit veya temiz baseline olusturulmasi

## 17. Tur 5B Kapsami

Tur 5B'nin amaci: gercek editor state ve timeline temeli.

Tur 5B kabul kriterleri:
- Editor ekrani mock olmaktan cikar.
- Proje state'i gercek veri modelinden beslenir.
- Sahne sirasi UI'da degistirilebilir.
- Sahne suresi UI'da degistirilebilir.
- Sahne metni UI'da degistirilebilir.
- Degisiklikler proje state'ine yazilir.
- Remotion preview bu state'i kullanir.
- Render API kullanici/proje state'ini okur.
- Output `output.mp4` gibi sabit tek dosyaya yazilmaz.
- Basit undo/version snapshot olusur.

Tur 5B kapsam disi:
- Tam AI chat agent
- Bulut queue
- Payment
- Mevcut video ozetleme
- Konusmaci analizi

## 18. Tur 5C ve Sonrasi

Tur 5C:
- Hazir komut sablonlari
- Plan oncesi onay ekrani
- Tahmini sure gosterimi
- Sablon secim akisi

Tur 5D:
- Proje bazli chat hafizasi
- Chat komutundan timeline planina ceviri
- Undo/version UI iyilestirmesi

Tur 6:
- Gercek upload/storage sertlestirme
- Render queue
- Daha guclu hata yonetimi
- Deploy edilebilir backend/worker ayrimi

Tur 7+:
- Mevcut videodan ozetleme
- Ceviri/dublaj
- Ses/muzik ayrimi
- Konusmaci analizi
- Uzun video akislari

## 19. Basari Metrikleri

Sürüm 1 icin urun basari sinyalleri:
- Kullanici ilk videoyu 5 dakikadan kisa surede uretebiliyor.
- Render sonucunda siyah/sessiz bos video cikmiyor.
- En az 3 farkli sahne MP4 icinde gorulebiliyor.
- Kullanici sahne sirasi ve sureyi UI'dan degistirebiliyor.
- Render cikisi indirilebilir ve tekrar uretilebilir.
- Kullanici bir degisikligi geri alabiliyor.
- Hazir komutlar bos chat kutusu sorununu azaltiyor.

Teknik basari sinyalleri:
- `pnpm typecheck`, `pnpm lint`, `pnpm test` geciyor.
- ffprobe metadata beklenen sure/frame degerlerini dogruluyor.
- MP4'ten cikarilan frame'ler beklenen sahneleri gosteriyor.
- Render output dosyalari benzersiz isimleniyor.
- Kaynakta Base64 placeholder, sabit duration ve mock output akisi kalmiyor.

## 20. Net Karar

PRODUCT_SPEC v2'ye gore CinoVid'in dogru yonu genis AI video studyosu vizyonudur, fakat Sürüm 1'in kapsami dar tutulmalidir.

Sıradaki urun/gelistirme karari:
- Once Tur 5A kanitlari korunur.
- Sonra stale dist/web mock temizligi yapilir.
- Ardindan Tur 5B ile gercek editor state + timeline kurulur.
- Chat AI, ozetleme, ceviri ve konusmaci analizi daha sonraki fazlara birakilir.

Tur 5B'ye gecis icin minimum sart: gercek render temelinin ayni ortamda dogrulanmis olmasi ve editorun render API'ye gercek proje state'i tasimaya hazir hale getirilmesi.
