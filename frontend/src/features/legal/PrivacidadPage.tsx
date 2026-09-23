import LegalDocumentPage from "./LegalDocumentPage";
import { PRIVACIDAD_SECTIONS, PRIVACIDAD_UPDATED } from "./privacidadContent";

export default function PrivacidadPage() {
  return (
    <LegalDocumentPage
      title="Política de privacidad y tratamiento de datos personales"
      updated={PRIVACIDAD_UPDATED}
      intro="En SoftOne360 tratamos datos personales con transparencia y en cumplimiento de la normativa colombiana de protección de datos (Ley 1581 de 2012). Este documento explica qué información recopilamos, para qué la usamos, cómo protegemos los datos obtenidos de servicios Google (Gmail) y cuáles son sus derechos."
      sections={PRIVACIDAD_SECTIONS}
      sibling={{ href: "/condiciones", label: "Condiciones del servicio" }}
    />
  );
}
