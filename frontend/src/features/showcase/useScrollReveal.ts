import { useEffect } from "react";

function revealInViewport(elements: NodeListOf<Element>): void {
  elements.forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
      el.classList.add("animate-in");
    }
  });
}

function setStagger(root: Element, selector: string, stepMs: number): void {
  root.querySelectorAll(selector).forEach((el, i) => {
    const htmlEl = el as HTMLElement;
    htmlEl.style.setProperty("--si", String(i));
    htmlEl.style.setProperty("--stagger", `${stepMs}ms`);
  });
}

const STAGGER_RULES: Array<{ selector: string; stepMs: number }> = [
  { selector: "#features .sc-cards-grid .animate", stepMs: 75 },
  { selector: ".sc-modules-grid .sc-module.animate", stepMs: 100 },
  { selector: "#benefits .sc-cards-grid .animate", stepMs: 80 },
  { selector: "#use-cases .sc-cards-grid .animate", stepMs: 120 },
  { selector: ".sc-pdm-caps .sc-pdm-cap.animate", stepMs: 70 },
  { selector: ".sc-pdm-feat-pill.animate", stepMs: 45 },
  { selector: ".sc-pdm-stats .animate", stepMs: 90 },
  { selector: ".sc-tech-grid .animate", stepMs: 55 },
];

export function useScrollReveal(rootSelector = ".showcase-main, .nos-page"): void {
  useEffect(() => {
    const roots = document.querySelectorAll(rootSelector);
    if (roots.length === 0) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      roots.forEach((root) => {
        root.querySelectorAll(".animate").forEach((el) => el.classList.add("animate-in"));
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0, rootMargin: "0px 0px -20px 0px" },
    );

    const revealEl = (el: Element) => {
      if (el.classList.contains("animate-in")) return;
      el.classList.add("animate-in");
      observer.unobserve(el);
    };

    const onScroll = () => {
      roots.forEach((root) => {
        root.querySelectorAll(".animate:not(.animate-in)").forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
            revealEl(el);
          }
        });
      });
    };

    roots.forEach((root) => {
      STAGGER_RULES.forEach(({ selector, stepMs }) => setStagger(root, selector, stepMs));

      const animated = root.querySelectorAll(".animate");
      animated.forEach((el) => observer.observe(el));
      requestAnimationFrame(() => {
        revealInViewport(animated);
        onScroll();
      });
    });

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [rootSelector]);
}
