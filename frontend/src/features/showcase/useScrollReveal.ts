import { useEffect } from "react";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function animateCounter(el: HTMLElement, duration = 1600): void {
  const text = el.textContent?.trim() || "";
  const match = text.match(/^([\d.]+)(.*)/);
  if (!match) return;
  const target = parseFloat(match[1]);
  const suffix = match[2];
  const decimals = match[1].includes(".") ? match[1].split(".")[1].length : 0;
  const startTime = performance.now();
  const step = (now: number) => {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - (1 - progress) ** 3;
    el.textContent = (target * eased).toFixed(decimals) + suffix;
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function revealElement(el: Element, reduced: boolean): void {
  el.classList.add("animate-in");
  if (reduced) return;
  el.querySelectorAll(".pdm-stat-value, .sc-metric-value").forEach((statEl) => {
    animateCounter(statEl as HTMLElement);
  });
}

export function useScrollReveal(rootSelector = ".showcase-main"): void {
  useEffect(() => {
    const root = document.querySelector(rootSelector);
    if (!root) return;

    const reduced = prefersReducedMotion();

    if (reduced) {
      root.querySelectorAll(".animate").forEach((el) => el.classList.add("animate-in"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            revealElement(entry.target, reduced);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.06, rootMargin: "0px 0px -40px 0px" },
    );

    const gridSelectors = [
      ".features-section .showcase-grid",
      ".benefits-section .showcase-grid",
      ".use-cases-section .showcase-grid",
      ".pdm-hero-section .showcase-grid",
      ".nos-objectives .showcase-grid",
      ".nos-intel .showcase-grid",
    ];
    gridSelectors.forEach((sel) => {
      root.querySelector(sel)?.querySelectorAll(".animate").forEach((el, i) => {
        (el as HTMLElement).style.setProperty("--si", String(i));
      });
    });

    root.querySelectorAll(".pdm-stats-row .animate, .sc-metrics .animate").forEach((el, i) => {
      (el as HTMLElement).style.setProperty("--si", String(i));
    });

    root.querySelectorAll(".tech-stack .animate, .sc-tech-grid .animate").forEach((el, i) => {
      (el as HTMLElement).style.setProperty("--si", String(i % 4));
    });

    root.querySelectorAll(".module-v2-block.animate, .sc-module.animate").forEach((el, i) => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.setProperty("--si", String(i % 2));
      htmlEl.classList.add(i % 2 === 1 ? "from-right" : "from-left");
    });

    // Scroll sections only — hero entrance is pure CSS in showcase.scss
    root.querySelectorAll(".animate").forEach((el) => observer.observe(el));

    const heroStatsTimer = window.setTimeout(() => {
      root.querySelectorAll(".hero-content .sc-stat-value, .sc-hero .sc-stat-value").forEach((el) => {
        animateCounter(el as HTMLElement, 1400);
      });
    }, 700);

    return () => {
      window.clearTimeout(heroStatsTimer);
      observer.disconnect();
    };
  }, [rootSelector]);
}
