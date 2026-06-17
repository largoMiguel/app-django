import { useEffect, useState } from "react";

const PHRASES = [
  "Inteligencia Artificial",
  "IA Generativa",
  "OpenAI Integrado",
  "Análisis Narrativo",
];

const TYPE_MS = 58;
const DELETE_MS = 34;
const HOLD_MS = 2400;

export default function HeroAiAccent() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setDisplayed(PHRASES[0]);
      return;
    }

    const phrase = PHRASES[phraseIndex];
    let timer: ReturnType<typeof setTimeout>;

    if (!isDeleting) {
      if (displayed.length < phrase.length) {
        timer = setTimeout(() => {
          setDisplayed(phrase.slice(0, displayed.length + 1));
        }, TYPE_MS);
      } else {
        timer = setTimeout(() => setIsDeleting(true), HOLD_MS);
      }
    } else if (displayed.length > 0) {
      timer = setTimeout(() => {
        setDisplayed(phrase.slice(0, displayed.length - 1));
      }, DELETE_MS);
    } else {
      setIsDeleting(false);
      setPhraseIndex((i) => (i + 1) % PHRASES.length);
    }

    return () => clearTimeout(timer);
  }, [displayed, isDeleting, phraseIndex]);

  return (
    <span className="sc-hero-ai-slot">
      <span className="sc-hero-ai-text" aria-live="polite">
        {displayed}
      </span>
      <span className="sc-hero-ai-cursor" aria-hidden="true" />
    </span>
  );
}
