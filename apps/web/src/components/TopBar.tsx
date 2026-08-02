"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

export default function TopBar() {
  const pathname = usePathname();
  const onProjects = pathname === "/projects";
  const onTools = pathname?.startsWith("/araclar") ?? false;

  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-current={pathname === "/" ? "page" : undefined}>
        <span className="brand-dot">◈</span>
        <span>
          CinoVidyo <span className="grad">AI Studio</span>
        </span>
      </Link>
      <div className="spacer" />
      <Link
        href="/projects"
        className={`nav-link ${onProjects ? "active" : ""}`}
        aria-current={onProjects ? "page" : undefined}
      >
        Projelerim
      </Link>
      <Link
        href="/araclar"
        className={`nav-link ${onTools ? "active" : ""}`}
        aria-current={onTools ? "page" : undefined}
      >
        Araçlar
      </Link>
      <ThemeToggle />
      <Link href="/new" className="btn btn-primary btn-sm">
        Yeni video
      </Link>
    </header>
  );
}
