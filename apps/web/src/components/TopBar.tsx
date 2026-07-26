import Link from "next/link";

export default function TopBar() {
  return (
    <header className="topbar">
      <Link href="/" className="brand">
        <span className="brand-dot">◈</span>
        <span>
          CinoVid <span className="grad">AI Studio</span>
        </span>
      </Link>
      <div className="spacer" />
      <Link href="/projects" className="nav-link">
        Projelerim
      </Link>
      <Link href="/new" className="btn btn-primary btn-sm">
        Yeni video
      </Link>
    </header>
  );
}
