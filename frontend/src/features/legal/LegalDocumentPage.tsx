import { Link } from "react-router-dom";
import ShowcaseLogo from "@/features/showcase/ShowcaseLogo";
import { CONTACT_EMAIL } from "@/features/showcase/showcaseData";
import "./legal.scss";

export interface LegalSection {
  id: string;
  title: string;
  blocks: LegalBlock[];
}

export type LegalBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "h3"; text: string };

interface Props {
  title: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
  sibling?: { href: string; label: string };
}

export default function LegalDocumentPage({ title, intro, updated, sections, sibling }: Props) {
  return (
    <div className="legal-page">
      <header className="legal-page__header">
        <div className="legal-page__header-inner">
          <Link to="/" className="legal-page__brand">
            <ShowcaseLogo size={44} />
            <span>
              <strong>SoftOne360</strong>
              <small>Gestión estratégica para entidades públicas</small>
            </span>
          </Link>
        </div>
      </header>
      <main className="legal-page__main">
        <p className="legal-page__meta">Última actualización: {updated}</p>
        <h1>{title}</h1>
        <p className="legal-page__intro">{intro}</p>
        {sections.map((section) => (
          <section key={section.id} id={section.id} className="legal-page__section">
            <h2>{section.title}</h2>
            {section.blocks.map((block, i) => {
              if (block.type === "p") {
                return <p key={i}>{block.text}</p>;
              }
              if (block.type === "h3") {
                return <h3 key={i}>{block.text}</h3>;
              }
              if (block.type === "ul") {
                return (
                  <ul key={i}>
                    {block.items.map((item) => (
                      <li key={item.slice(0, 40)}>{item}</li>
                    ))}
                  </ul>
                );
              }
              return (
                <ol key={i}>
                  {block.items.map((item) => (
                    <li key={item.slice(0, 40)}>{item}</li>
                  ))}
                </ol>
              );
            })}
          </section>
        ))}
        <footer className="legal-page__footer">
          <p>
            Contacto:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            {sibling ? (
              <>
                {" · "}
                <Link to={sibling.href}>{sibling.label}</Link>
              </>
            ) : null}
            {" · "}
            <Link to="/">Inicio</Link>
          </p>
          <p>© {new Date().getFullYear()} SoftOne360. República de Colombia.</p>
        </footer>
      </main>
    </div>
  );
}
