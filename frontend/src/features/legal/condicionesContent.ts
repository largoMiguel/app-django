import type { LegalSection } from "./LegalDocumentPage";

export const CONDICIONES_UPDATED = "23 de septiembre de 2026";

export const CONDICIONES_SECTIONS: LegalSection[] = [
  {
    id: "aceptacion",
    title: "1. Aceptación",
    blocks: [
      {
        type: "p",
        text: "Al acceder a softone360.com, app.softone360.com o usar la plataforma SoftOne360, usted acepta estas Condiciones del Servicio. Si actúa en nombre de una entidad pública, declara tener facultades para vincularla. Si no está de acuerdo, debe abstenerse de usar el servicio.",
      },
    ],
  },
  {
    id: "servicio",
    title: "2. Descripción del servicio",
    blocks: [
      {
        type: "p",
        text: "SoftOne360 es una plataforma de software como servicio (SaaS) para apoyar la gestión institucional de entidades públicas en Colombia, incluyendo de forma modular: PQRS (Ley 1755 de 2015), Plan de Desarrollo Municipal (PDM), planes institucionales (Decreto 612), contratación (SECOP), correspondencia, asistencia, gestión documental, PIC y otras funcionalidades activadas por contrato.",
      },
      {
        type: "p",
        text: "El alcance concreto depende del contrato o acuerdo con cada entidad y de los módulos habilitados en configuración.",
      },
    ],
  },
  {
    id: "cuentas",
    title: "3. Cuentas y acceso",
    blocks: [
      {
        type: "ul",
        items: [
          "El acceso a la aplicación autenticada requiere invitación o creación de usuario por un administrador autorizado de la entidad.",
          "La autenticación se realiza mediante Clerk u otro proveedor configurado; usted es responsable de la confidencialidad de sus credenciales.",
          "Debe notificar de inmediato accesos no autorizados a contactenos@softone360.com y al administrador de su entidad.",
          "SoftOne360 puede suspender cuentas ante indicios de fraude, incumplimiento o riesgo de seguridad.",
        ],
      },
    ],
  },
  {
    id: "uso",
    title: "4. Uso permitido y prohibiciones",
    blocks: [
      { type: "p", text: "Usted se compromete a:" },
      {
        type: "ul",
        items: [
          "Usar la plataforma conforme a la ley colombiana, la normativa de la entidad y las políticas internas aplicables.",
          "Ingresar información veraz en PQRS, correspondencia y demás módulos.",
          "Respetar derechos de autor y confidencialidad de terceros en documentos cargados.",
        ],
      },
      { type: "p", text: "Queda prohibido:" },
      {
        type: "ul",
        items: [
          "Intentar acceder a datos de otra entidad o usuarios sin autorización (multi-tenancy).",
          "Realizar ingeniería inversa, escaneo de vulnerabilidades no autorizado o sobrecarga intencional del sistema.",
          "Usar la plataforma para spam, malware o fines ajenos a la gestión pública contratada.",
          "Revender o sublicenciar el acceso sin acuerdo escrito con SoftOne360.",
        ],
      },
    ],
  },
  {
    id: "google",
    title: "5. Integraciones de terceros (Google Gmail)",
    blocks: [
      {
        type: "p",
        text: "Las funciones opcionales de conexión con Google Gmail y el complemento de radicación dependen de los servicios de Google y de la autorización del usuario. Al conectar Gmail, usted acepta también las políticas de Google aplicables. SoftOne360 no es responsable por indisponibilidad, cambios de API o suspensiones impuestas por Google.",
      },
    ],
  },
  {
    id: "ia",
    title: "6. Funciones de inteligencia artificial",
    blocks: [
      {
        type: "p",
        text: "Cuando la entidad habilita módulos con IA (por ejemplo extracción de PQRS, informes o chat PDM), los resultados son asistencias automatizadas. El usuario y la entidad deben revisar y validar la información antes de decisiones administrativas o respuestas oficiales. SoftOne360 no garantiza exactitud absoluta de salidas generadas por modelos de terceros.",
      },
    ],
  },
  {
    id: "datos",
    title: "7. Datos personales",
    blocks: [
      {
        type: "p",
        text: "El tratamiento de datos personales se rige por la Política de Privacidad publicada en https://softone360.com/privacidad, parte integrante de estas Condiciones. La entidad contratante actúa como responsable frente a los ciudadanos en muchos tratamientos (PQRS); SoftOne360 actúa como encargado o responsable según el flujo descrito en dicha política.",
      },
    ],
  },
  {
    id: "propiedad",
    title: "8. Propiedad intelectual",
    blocks: [
      {
        type: "p",
        text: "SoftOne360, su código, diseño, marcas y documentación son propiedad de sus titulares. Se concede a la entidad y usuarios autorizados una licencia limitada, no exclusiva e intransferible para usar la plataforma durante la vigencia del contrato. Los contenidos cargados por la entidad (documentos, PQRS, logos) permanecen bajo titularidad de la entidad o del titular correspondiente.",
      },
    ],
  },
  {
    id: "disponibilidad",
    title: "9. Disponibilidad y mantenimiento",
    blocks: [
      {
        type: "p",
        text: "Procuramos alta disponibilidad pero no garantizamos servicio ininterrumpido. Pueden existir ventanas de mantenimiento, actualizaciones de seguridad o eventos de fuerza mayor. Informaremos mantenimientos programados cuando sea razonablemente posible.",
      },
    ],
  },
  {
    id: "limitacion",
    title: "10. Limitación de responsabilidad",
    blocks: [
      {
        type: "p",
        text: "En la máxima medida permitida por la ley colombiana, SoftOne360 no será responsable por daños indirectos, lucro cesante o pérdida de datos derivados del uso o imposibilidad de uso del servicio, salvo dolo o culpa grave demostrada. La responsabilidad total acumulada frente a una entidad cliente se limitará, salvo pacto distinto en contrato, al monto pagado por la entidad en los doce (12) meses anteriores al hecho generador.",
      },
    ],
  },
  {
    id: "terminacion",
    title: "11. Terminación",
    blocks: [
      {
        type: "p",
        text: "La entidad puede solicitar terminación conforme al contrato. SoftOne360 puede suspender o terminar el acceso por incumplimiento grave de estas Condiciones o impago. Tras la terminación, aplican políticas de exportación y retención acordadas contractualmente.",
      },
    ],
  },
  {
    id: "ley",
    title: "12. Ley aplicable y jurisdicción",
    blocks: [
      {
        type: "p",
        text: "Estas Condiciones se rigen por las leyes de la República de Colombia. Cualquier controversia se someterá a los jueces competentes de Colombia, sin perjuicio de mecanismos de solución amigable o arbitraje pactados en contrato comercial con la entidad.",
      },
    ],
  },
  {
    id: "contacto",
    title: "13. Contacto",
    blocks: [
      {
        type: "p",
        text: "Para consultas sobre estas Condiciones: contactenos@softone360.com · Sitio: https://softone360.com",
      },
    ],
  },
];
