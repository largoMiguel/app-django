import { useEffect } from "react";

export function useNosotrosReveal(): void {
  useEffect(() => {
    const root = document.querySelector(".nos-page");
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -50px 0px" },
    );

    root.querySelectorAll(".nos-animate").forEach((el, i) => {
      (el as HTMLElement).style.setProperty("--si", String(i % 6));
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);
}
