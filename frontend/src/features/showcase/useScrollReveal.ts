import { useEffect } from "react";

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

export function useScrollReveal(rootSelector = ".showcase-main"): void {
  useEffect(() => {
    const root = document.querySelector(rootSelector);
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-in");
            entry.target.querySelectorAll(".pdm-stat-value").forEach((el) => {
              animateCounter(el as HTMLElement);
            });
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -50px 0px" },
    );

    const gridSelectors = [
      ".features-section .showcase-grid",
      ".benefits-section .showcase-grid",
      ".use-cases-section .showcase-grid",
      ".pdm-hero-section .showcase-grid",
    ];
    gridSelectors.forEach((sel) => {
      root.querySelector(sel)?.querySelectorAll(".animate").forEach((el, i) => {
        (el as HTMLElement).style.setProperty("--si", String(i));
      });
    });

    root.querySelectorAll(".pdm-stats-row .animate").forEach((el, i) => {
      (el as HTMLElement).style.setProperty("--si", String(i));
    });

    root.querySelectorAll(".tech-stack .animate").forEach((el, i) => {
      (el as HTMLElement).style.setProperty("--si", String(i % 4));
    });

    root.querySelectorAll(".module-v2-block.animate").forEach((el, i) => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.setProperty("--si", String(i % 2));
      htmlEl.classList.add(i % 2 === 1 ? "from-right" : "from-left");
    });

    root.querySelectorAll(".animate").forEach((el) => observer.observe(el));

    const heroStatsTimer = window.setTimeout(() => {
      root.querySelectorAll(".hero-stats .stat-value").forEach((el) => {
        animateCounter(el as HTMLElement, 1400);
      });
    }, 500);

    return () => {
      window.clearTimeout(heroStatsTimer);
      observer.disconnect();
    };
  }, [rootSelector]);
}
