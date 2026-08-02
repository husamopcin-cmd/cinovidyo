import Link from "next/link";
import TopBar from "../../components/TopBar";

export const metadata = {
  title: "Video araçları — CinoVid AI Studio",
  description:
    "Videonu sıkıştır, küçült ve paylaşıma hazırla. Her şey tarayıcında çalışır; dosyan internete yüklenmez.",
};

/** Hazır araçlar ve yakında eklenecekler. Kilitli olanlar dürüstçe "yakında" der. */
const TOOLS = [
  {
    href: "/araclar/sikistir",
    icon: "🗜️",
    title: "Sıkıştır",
    desc: "Büyük videoyu küçült, paylaşması kolay olsun.",
    ready: true,
  },
  {
    href: "/araclar/donustur",
    icon: "📐",
    title: "Çözünürlük / format",
    desc: "4K'yı 1080p yap, MP4 ↔ WebM dönüştür.",
    ready: true,
  },
  {
    href: "/araclar/kirp",
    icon: "✂️",
    title: "Kırp",
    desc: "Yatay videoyu dikey (9:16), kare veya 16:9 formata kırp.",
    ready: true,
  },
  {
    href: "/araclar/ses",
    icon: "🎵",
    title: "Sesi ayıkla",
    desc: "Videodan sesi çıkar veya tamamen kaldır.",
    ready: true,
  },
];

export default function Araclar() {
  return (
    <>
      <TopBar />
      <main className="shell stack">
        <div>
          <h1 className="hero-title" style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)" }}>
            Video araçları
          </h1>
          <p className="lead" style={{ marginTop: 10 }}>
            Video üretmeden de kullanabilirsin. Dosyanı seç, işini yap, indir — hepsi cihazında
            çalışır, hiçbir dosya sunucuya gitmez.
          </p>
        </div>

        <div className="grid grid-2">
          {TOOLS.map((t) =>
            t.ready && t.href ? (
              <Link key={t.title} href={t.href} className="card card-hover stack" style={{ gap: 8 }}>
                <div style={{ fontSize: 26 }}>{t.icon}</div>
                <div className="h2">{t.title}</div>
                <div className="muted">{t.desc}</div>
              </Link>
            ) : (
              <div key={t.title} className="card stack" style={{ gap: 8, opacity: 0.55 }}>
                <div style={{ fontSize: 26 }}>{t.icon}</div>
                <div className="row">
                  <span className="h2">{t.title}</span>
                  <span className="badge">yakında</span>
                </div>
                <div className="muted">{t.desc}</div>
              </div>
            )
          )}
        </div>

        <div className="card">
          <div className="h2">Nasıl çalışıyor?</div>
          <p className="muted" style={{ marginTop: 8 }}>
            Video işleme, tarayıcının donanım hızlandırmalı video kodlayıcısıyla (WebCodecs) yapılır.
            Bu sayede işlem gerçek zamandan çok daha hızlıdır ve dosyan hiçbir zaman cihazından
            çıkmaz. Chrome ve Edge tam destekler; desteklemeyen tarayıcıda araç açıkça uyarır.
          </p>
        </div>
      </main>
    </>
  );
}
