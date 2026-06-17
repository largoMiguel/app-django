import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import ShowcaseLogo from "./ShowcaseLogo";

export type ShowcaseNavItem =
  | { type: "scroll"; sectionId: string; label: string }
  | { type: "link"; to: string; label: string }
  | { type: "current"; label: string };

interface ShowcaseNavProps {
  items: ShowcaseNavItem[];
  cta: ReactNode;
  navLabel?: string;
}

export function scrollToSection(id: string) {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({
    behavior: prefersReducedMotion ? "auto" : "smooth",
    block: "start",
  });
}

export default function ShowcaseNav({ items, cta, navLabel = "Navegación principal" }: ShowcaseNavProps) {
  useEffect(() => {
    const nav = document.querySelector(".sc-nav");
    if (!nav) return;

    const onScroll = () => {
      nav.toggleAttribute("data-scrolled", window.scrollY > 12);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sc-nav">
      <div className="container sc-nav-inner">
        <Link to="/" className="sc-brand" aria-label="SoftOne360 inicio">
          <ShowcaseLogo size={36} className="sc-brand-logo" />
          <span className="sc-brand-text">
            <strong>SoftOne360</strong>
            <small>Gestión estratégica, visión total</small>
          </span>
        </Link>

        <nav className="sc-nav-links" aria-label={navLabel}>
          {items.map((item) => {
            if (item.type === "scroll") {
              return (
                <button
                  key={item.sectionId}
                  type="button"
                  className="sc-nav-link"
                  onClick={() => scrollToSection(item.sectionId)}
                >
                  {item.label}
                </button>
              );
            }

            if (item.type === "current") {
              return (
                <span key={item.label} className="sc-nav-link sc-nav-link-active" aria-current="page">
                  {item.label}
                </span>
              );
            }

            return (
              <Link key={item.to} to={item.to} className="sc-nav-link">
                {item.label}
              </Link>
            );
          })}
        </nav>

        {cta}
      </div>
    </header>
  );
}
