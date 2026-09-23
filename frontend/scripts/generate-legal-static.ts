/**
 * Genera HTML estático en public/ para /privacidad y /condiciones.
 * Los revisores de Google OAuth suelen leer el HTML sin ejecutar el bundle React.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LegalBlock, LegalSection } from "../src/features/legal/LegalDocumentPage";
import { CONDICIONES_SECTIONS, CONDICIONES_UPDATED } from "../src/features/legal/condicionesContent";
import { PRIVACIDAD_SECTIONS, PRIVACIDAD_UPDATED } from "../src/features/legal/privacidadContent";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderBlock(block: LegalBlock): string {
  if (block.type === "p") {
    return `<p>${escapeHtml(block.text)}</p>`;
  }
  if (block.type === "h3") {
    return `<h3>${escapeHtml(block.text)}</h3>`;
  }
  const tag = block.type === "ul" ? "ul" : "ol";
  const items = block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n");
  return `<${tag}>${items}</${tag}>`;
}

function renderSections(sections: LegalSection[]): string {
  return sections
    .map(
      (section) => `
    <section id="${escapeHtml(section.id)}">
      <h2>${escapeHtml(section.title)}</h2>
      ${section.blocks.map(renderBlock).join("\n")}
    </section>`,
    )
    .join("\n");
}

function legalPageHtml(opts: {
  path: string;
  pageTitle: string;
  metaDescription: string;
  updated: string;
  intro: string;
  h1: string;
  sections: LegalSection[];
  sibling?: { href: string; label: string };
}): string {
  const canonical = `https://softone360.com${opts.path}`;
  const sibling = opts.sibling
    ? ` · <a href="${escapeHtml(opts.sibling.href)}">${escapeHtml(opts.sibling.label)}</a>`
    : "";
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(opts.pageTitle)} | SoftOne360</title>
  <meta name="description" content="${escapeHtml(opts.metaDescription)}" />
  <link rel="canonical" href="${canonical}" />
  <style>
    :root { color-scheme: light; }
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; line-height: 1.65; max-width: 52rem; margin: 0 auto; padding: 1.5rem 1.25rem 3rem; color: #0f172a; background: #f8fafc; }
    header { border-bottom: 1px solid #cbd5e1; padding-bottom: 1rem; margin-bottom: 1.5rem; }
    header a { color: #1a5f8c; font-weight: 600; text-decoration: none; }
    h1 { font-size: 1.75rem; line-height: 1.25; margin: 0 0 0.75rem; }
    h2 { font-size: 1.2rem; margin: 2rem 0 0.75rem; color: #1e3a5f; }
    h3 { font-size: 1.05rem; margin: 1.25rem 0 0.5rem; }
    p, ul, ol { margin: 0.75rem 0; }
    li { margin: 0.35rem 0; }
    .meta { color: #64748b; font-size: 0.9rem; }
    .intro { font-size: 1.05rem; }
    footer { margin-top: 2.5rem; padding-top: 1rem; border-top: 1px solid #cbd5e1; font-size: 0.9rem; color: #475569; }
    a { color: #1a5f8c; }
    table { width: 100%; border-collapse: collapse; font-size: 0.92rem; margin: 1rem 0; }
    th, td { border: 1px solid #cbd5e1; padding: 0.5rem 0.65rem; text-align: left; vertical-align: top; }
    th { background: #e2e8f0; }
  </style>
</head>
<body>
  <header>
    <a href="/">SoftOne360</a> — Gestión estratégica para entidades públicas
  </header>
  <p class="meta">Última actualización: ${escapeHtml(opts.updated)}</p>
  <h1>${escapeHtml(opts.h1)}</h1>
  <p class="intro">${escapeHtml(opts.intro)}</p>
  ${renderSections(opts.sections)}
  <footer>
    <p>Contacto: <a href="mailto:contactenos@softone360.com">contactenos@softone360.com</a>${sibling} · <a href="/">Inicio</a></p>
    <p>© ${new Date().getFullYear()} SoftOne360. República de Colombia.</p>
  </footer>
</body>
</html>`;
}

function writeLegal(pathSegment: string, html: string): void {
  const dir = join(publicDir, pathSegment);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html, "utf8");
}

const privacidadHtml = legalPageHtml({
  path: "/privacidad",
  pageTitle: "Política de privacidad y tratamiento de datos personales",
  metaDescription:
    "Política de privacidad de SoftOne360: datos PQRS, Gmail API, OAuth, Clerk, IA, almacenamiento y derechos Ley 1581 Colombia.",
  updated: PRIVACIDAD_UPDATED,
  h1: "Política de privacidad y tratamiento de datos personales",
  intro:
    "En SoftOne360 tratamos datos personales con transparencia y en cumplimiento de la normativa colombiana (Ley 1581 de 2012). Este documento detalla qué información recopilamos, cómo la usamos, cómo accedemos a datos de Google/Gmail cuando usted lo autoriza, y cuáles son sus derechos.",
  sections: PRIVACIDAD_SECTIONS,
  sibling: { href: "/condiciones", label: "Condiciones del servicio" },
});

const condicionesHtml = legalPageHtml({
  path: "/condiciones",
  pageTitle: "Condiciones del servicio",
  metaDescription:
    "Condiciones de uso de la plataforma SoftOne360 SaaS para entidades públicas en Colombia.",
  updated: CONDICIONES_UPDATED,
  h1: "Condiciones del servicio",
  intro:
    "Estas condiciones regulan el acceso y uso de los sitios web y la plataforma SoftOne360 por entidades públicas, usuarios autorizados y visitantes del sitio de marketing.",
  sections: CONDICIONES_SECTIONS,
  sibling: { href: "/privacidad", label: "Política de privacidad" },
});

writeLegal("privacidad", privacidadHtml);
writeLegal("condiciones", condicionesHtml);

console.log("Generated public/privacidad/index.html and public/condiciones/index.html");
