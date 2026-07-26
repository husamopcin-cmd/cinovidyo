import Link from "next/link";
import TopBar from "../components/TopBar";

const MODES = [
  { icon: "📝", title: "Metin / Hikaye", desc: "Yazdığın metni sahnelere böler, altyazılı videoya çevirir." },
  { icon: "📄", title: "PDF / Ders notu", desc: "PDF'ten metni çıkarır, konu konu anlatan eğitim videosu kurar." },
  { icon: "🖼️", title: "Görseller", desc: "En fazla 20 görseli zoom/kaydırma efektleriyle birleştirir." },
  { icon: "🎬", title: "Hazır video", desc: "Yüklediğin videonun üstüne altyazı, müzik ve efekt giydirir." },
];

const FACTS = [
  { k: "Üretim", v: "Cihazında", d: "Videonu doğrudan tarayıcıda oluştur ve indir." },
  { k: "Üyelik", v: "Yok", d: "Hesap açman gerekmez, veriler cihazında kalır." },
  { k: "Çıktı", v: "9:16 · 1080×1920", d: "Reels / Shorts / TikTok formatında video dosyası." },
];

export default function Home() {
  return (
    <>
      <TopBar />
      <main className="shell">
        <section className="stack" style={{ padding: "48px 0 40px", gap: 22 }}>
          <span className="badge">Yapay zekâ destekli dikey video stüdyosu</span>
          <h1 className="hero-title">
            Fikrini <span className="grad">dikey videoya</span> çevir.
            <br />
            Dakikalar içinde yayına hazır.
          </h1>
          <p className="lead">
            Metnini, ders notunu, görsellerini veya hazır videonu yükle; AI asistanı sahneleri
            kursun, sen düzenle, videoyu cihazında üret ve indir. Yüklediğin hiçbir dosya
            internete çıkmaz.
          </p>
          <div className="row" style={{ gap: 12 }}>
            <Link href="/new" className="btn btn-primary btn-lg">
              Videoya başla →
            </Link>
            <Link href="/projects" className="btn btn-lg">
              Projelerim
            </Link>
          </div>
        </section>

        <section className="grid grid-2" style={{ marginBottom: 34 }}>
          {MODES.map((m) => (
            <div key={m.title} className="card">
              <div style={{ fontSize: 26, marginBottom: 8 }}>{m.icon}</div>
              <div className="h2" style={{ marginBottom: 6 }}>
                {m.title}
              </div>
              <p className="muted">{m.desc}</p>
            </div>
          ))}
        </section>

        <section className="grid grid-3">
          {FACTS.map((f) => (
            <div key={f.k} className="card">
              <div className="label">{f.k}</div>
              <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.02em" }}>{f.v}</div>
              <p className="tiny" style={{ marginTop: 6 }}>
                {f.d}
              </p>
            </div>
          ))}
        </section>

        <section className="card" style={{ marginTop: 34 }}>
          <div className="h2" style={{ marginBottom: 10 }}>
            Nasıl çalışıyor?
          </div>
          <p className="muted">
            Sahneler tarayıcıdaki bir canvas üzerine 1080×1920 çözünürlükte çizilir ve{" "}
            <strong>MediaRecorder</strong> ile gerçek bir video dosyasına kaydedilir. Kayıt gerçek
            zamanlıdır: 30 saniyelik video yaklaşık 30 saniyede üretilir. Projelerin ve dosyaların
            tarayıcının IndexedDB deposunda tutulur — başka bir cihazda görünmez, tarayıcı
            verilerini silersen kaybolur.
          </p>
        </section>
      </main>
    </>
  );
}
