import LegalDocumentPage from "./LegalDocumentPage";
import { CONDICIONES_SECTIONS, CONDICIONES_UPDATED } from "./condicionesContent";

export default function CondicionesPage() {
  return (
    <LegalDocumentPage
      title="Condiciones del servicio"
      updated={CONDICIONES_UPDATED}
      intro="Estas condiciones regulan el uso de los sitios web y la plataforma SoftOne360 por entidades públicas, usuarios autorizados y visitantes. Léalas junto con nuestra Política de Privacidad."
      sections={CONDICIONES_SECTIONS}
      sibling={{ href: "/privacidad", label: "Política de privacidad" }}
    />
  );
}
