import type { LegalSection } from "./LegalDocumentPage";

export const PRIVACIDAD_UPDATED = "23 de septiembre de 2026";

export const PRIVACIDAD_SECTIONS: LegalSection[] = [
  {
    id: "responsable",
    title: "1. Responsable del tratamiento",
    blocks: [
      {
        type: "p",
        text: "SoftOne360 (en adelante, «SoftOne360» o «nosotros») es el responsable del tratamiento de los datos personales recogidos a través de los sitios web softone360.com, app.softone360.com, demo.softone360.com, subdominios asociados (por ejemplo files.softone360.com) y la plataforma de software como servicio (SaaS) destinada a entidades públicas territoriales y organismos en Colombia.",
      },
      {
        type: "p",
        text: "Correo de contacto para asuntos de privacidad y protección de datos: contactenos@softone360.com. Asunto sugerido: «Protección de datos personales».",
      },
    ],
  },
  {
    id: "alcance",
    title: "2. Alcance y definiciones",
    blocks: [
      {
        type: "p",
        text: "Esta Política describe cómo tratamos datos personales conforme a la Ley 1581 de 2012, el Decreto 1377 de 2013 y demás normas aplicables en Colombia sobre protección de datos (Habeas Data).",
      },
      {
        type: "ul",
        items: [
          "Titular: persona natural cuya información es objeto de tratamiento (ciudadanos, funcionarios, contratistas).",
          "Entidad cliente: municipio u organismo que contrata SoftOne360 y define el uso operativo de la plataforma.",
          "Usuario autorizado: funcionario o contratista con cuenta en la plataforma (autenticación vía Clerk).",
          "Datos de PQRS y gestión: información ingresada en módulos PQRS, correspondencia, PDM, planes, asistencia, SECOP, gestión documental y demás módulos habilitados por la entidad.",
        ],
      },
    ],
  },
  {
    id: "datos",
    title: "3. Datos personales que tratamos",
    blocks: [
      { type: "h3", text: "3.1 Cuentas y acceso" },
      {
        type: "ul",
        items: [
          "Identificación y contacto: nombre, correo electrónico institucional o corporativo, rol, entidad y secretaría asignada.",
          "Datos de autenticación gestionados por Clerk (identificador de usuario, sesión, factores de autenticación). SoftOne360 no almacena contraseñas en texto claro.",
          "Registros técnicos: dirección IP, agente de usuario, marcas de tiempo, identificadores de sesión para seguridad y auditoría.",
        ],
      },
      { type: "h3", text: "3.2 Módulo PQRS y portal ciudadano" },
      {
        type: "ul",
        items: [
          "Datos del solicitante: nombre, documento de identidad, correo, teléfono, dirección, contenido de la solicitud, adjuntos.",
          "Metadatos de radicación: número de radicado, fechas, canal de llegada, secretaría asignada, historial de estados.",
          "Datos procesados con inteligencia artificial (cuando la entidad tiene habilitado el módulo): texto extraído de documentos para clasificación; no usamos esos datos para entrenar modelos públicos de terceros más allá del procesamiento solicitado por la entidad.",
        ],
      },
      { type: "h3", text: "3.3 Integración con Google (Gmail) — opcional" },
      {
        type: "p",
        text: "Cuando la entidad activa las funciones de correo institucional, los usuarios autorizados pueden conectar su cuenta Google Workspace / Gmail y, opcionalmente, usar el complemento (add-on) de Gmail para radicar PQRS. En ese caso tratamos:",
      },
      {
        type: "ul",
        items: [
          "Tokens OAuth (incluido refresh token) cifrados en nuestros servidores, exclusivamente para enviar respuestas autorizadas (scope gmail.send) y operar el complemento.",
          "Contenido del correo abierto en Gmail cuando el usuario inicia radicación desde el complemento: asunto, cuerpo, remitente, destinatarios, identificadores de mensaje/hilo, adjuntos necesarios para la PQRS.",
          "Identificador de correo verificado (userinfo.email) para asociar la acción al usuario registrado en SoftOne360.",
        ],
      },
      {
        type: "p",
        text: "No vendemos datos de Gmail. No usamos datos de Gmail para publicidad. El acceso se limita a las funciones descritas y solicitadas explícitamente por el usuario en la interfaz.",
      },
      { type: "h3", text: "3.4 Otros módulos" },
      {
        type: "ul",
        items: [
          "Asistencia: datos biométricos faciales y registros de marcación cuando la entidad habilita el módulo, con finalidades de control de asistencia.",
          "Archivos almacenados en Backblaze B2 (u otro almacenamiento configurado): documentos, evidencias, anexos PQRS/PDM/planes, según uso de cada entidad.",
          "Chat IA PDM público: mensajes anonimizados o asociados a conversación; IP hasheada para analítica agregada.",
        ],
      },
    ],
  },
  {
    id: "finalidades",
    title: "4. Finalidades del tratamiento",
    blocks: [
      {
        type: "ul",
        items: [
          "Prestar el servicio SaaS contratado por la entidad pública (gestión PQRS, planes, PDM, contratación, etc.).",
          "Autenticar usuarios, aplicar roles y permisos (RBAC) y registrar auditoría de acciones sensibles.",
          "Radicar, asignar, responder y cerrar PQRS; notificar al ciudadano por correo cuando el funcionario lo solicite.",
          "Operar integraciones opcionales: Gmail (envío y radicación desde complemento), ingreso IMAP/ZeptoMail, OpenAI para extracción/clasificación cuando está habilitado.",
          "Cumplir obligaciones legales, atender requerimientos de autoridades competentes y resolver reclamos.",
          "Mejorar seguridad, prevenir fraude y abusos, y mantener disponibilidad (Cloudflare, logs técnicos).",
        ],
      },
    ],
  },
  {
    id: "google",
    title: "5. Uso de datos de Google / Gmail API",
    blocks: [
      {
        type: "p",
        text: "SoftOne360 cumple con la Política de datos de usuario de los servicios de Google API, incluidos los requisitos de uso limitado (Limited Use). Los scopes OAuth que podemos solicitar incluyen, según la función:",
      },
      {
        type: "ul",
        items: [
          "https://www.googleapis.com/auth/gmail.send — enviar respuestas de PQRS desde la cuenta institucional conectada del funcionario.",
          "https://www.googleapis.com/auth/gmail.addons.execute y gmail.addons.current.message.action — ejecutar el complemento de Gmail para radicar el correo abierto como PQRS.",
          "https://www.googleapis.com/auth/userinfo.email — identificar la cuenta Google del funcionario.",
          "https://www.googleapis.com/auth/script.locale — idioma de la interfaz del complemento.",
        ],
      },
      {
        type: "p",
        text: "Los datos obtenidos de Gmail se usan únicamente para prestar las funciones anteriores a la entidad y al usuario que autorizó el acceso. No los compartimos con terceros salvo encargados del tratamiento necesarios para operar la infraestructura (hosting, cifrado, base de datos), bajo contrato y medidas de seguridad. El usuario puede revocar el acceso en Google (permisos de la cuenta) y desconectar Gmail en Configuración → Correo institucional dentro de SoftOne360.",
      },
    ],
  },
  {
    id: "encargados",
    title: "6. Encargados y transferencias",
    blocks: [
      {
        type: "p",
        text: "Podemos apoyarnos en proveedores que actúan como encargados del tratamiento, entre otros:",
      },
      {
        type: "ul",
        items: [
          "Clerk — autenticación y gestión de identidad.",
          "Google Cloud / Google Workspace — OAuth, complemento Gmail y APIs asociadas.",
          "OpenAI — procesamiento de texto para funciones de IA cuando la entidad las activa.",
          "Backblaze B2 — almacenamiento de archivos.",
          "ZeptoMail (Zoho) — envío transaccional de correo cuando no se usa Gmail del funcionario.",
          "Cloudflare — DNS, túnel, CDN, protección perimetral y worker de entrega de archivos firmados.",
          "Proveedores de infraestructura (hosting en servidores bajo nuestro control).",
        ],
      },
      {
        type: "p",
        text: "Algunos encargados pueden tratar datos fuera de Colombia (por ejemplo, Estados Unidos). Adoptamos cláusulas contractuales y medidas técnicas razonables (cifrado en tránsito, minimización de datos) acordes al riesgo del tratamiento.",
      },
    ],
  },
  {
    id: "conservacion",
    title: "7. Conservación",
    blocks: [
      {
        type: "p",
        text: "Conservamos los datos mientras exista la relación con la entidad cliente, el usuario mantenga cuenta activa o sea necesario para cumplir finalidades legales (por ejemplo, términos de archivo de PQRS de la entidad). Los tokens OAuth de Gmail se eliminan al desconectar la cuenta o desactivar al usuario. Los respaldos de base de datos siguen la política de retención interna (copias rotativas).",
      },
    ],
  },
  {
    id: "seguridad",
    title: "8. Seguridad",
    blocks: [
      {
        type: "ul",
        items: [
          "Comunicaciones cifradas (HTTPS/TLS) hacia usuarios y hacia APIs de terceros.",
          "Tokens OAuth de Gmail cifrados (Fernet) en base de datos.",
          "Segmentación de red, contenedores sin privilegios elevados, secretos en variables de entorno.",
          "Control de acceso por roles (RBAC) y multi-tenancy por entidad.",
          "Archivos sensibles servidos mediante URLs firmadas de corta duración cuando aplica.",
        ],
      },
    ],
  },
  {
    id: "derechos",
    title: "9. Derechos de los titulares (Colombia)",
    blocks: [
      {
        type: "p",
        text: "En los términos de la Ley 1581 de 2012, los titulares pueden:",
      },
      {
        type: "ul",
        items: [
          "Conocer, actualizar y rectificar sus datos personales.",
          "Solicitar prueba de la autorización otorgada.",
          "Revocar la autorización y/o solicitar la supresión cuando no exista deber legal o contractual de conservar.",
          "Acceder gratuitamente a sus datos personales tratados.",
          "Presentar quejas ante la Superintendencia de Industria y Comercio (SIC) cuando consideren vulnerados sus derechos.",
        ],
      },
      {
        type: "p",
        text: "Las solicitudes pueden enviarse a contactenos@softone360.com indicando nombre completo, documento, descripción de la solicitud y medio de respuesta. Responderemos en los plazos legales. Si usted es ciudadano que radicó una PQRS, la entidad pública titular del expediente puede ser corresponsable del archivo; también puede contactar a la entidad donde presentó la solicitud.",
      },
    ],
  },
  {
    id: "menores",
    title: "10. Menores de edad",
    blocks: [
      {
        type: "p",
        text: "La plataforma está dirigida a entidades públicas y usuarios autorizados (funcionarios/contratistas). El portal ciudadano puede recibir PQRS de cualquier persona; si se trata de menores, se recomienda el acompañamiento de un adulto responsable. No recopilamos intencionalmente datos de menores con fines comerciales.",
      },
    ],
  },
  {
    id: "cookies",
    title: "11. Cookies y tecnologías similares",
    blocks: [
      {
        type: "p",
        text: "Usamos cookies y almacenamiento local estrictamente necesarios para sesión (Clerk), preferencias de entidad activa y seguridad. Cloudflare puede registrar cookies técnicas de rendimiento y protección. Puede gestionar cookies desde su navegador; desactivarlas puede afectar el inicio de sesión.",
      },
    ],
  },
  {
    id: "cambios",
    title: "12. Cambios a esta política",
    blocks: [
      {
        type: "p",
        text: "Publicaremos la versión vigente en https://softone360.com/privacidad con la fecha de actualización. Cambios materiales serán comunicados por medios razonables (aviso en la aplicación o correo a administradores de entidad).",
      },
    ],
  },
];
