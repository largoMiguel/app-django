"""Textos legales parametrizados para el informe de seguimiento Decreto 612."""
from __future__ import annotations

from datetime import date

from apps.planes.models import Trimestre


def trimestre_label(trimestre: int) -> str:
    try:
        return Trimestre(trimestre).label
    except ValueError:
        return f"Trimestre {trimestre}"


def build_narrativa_context(
    *,
    entity_name: str,
    anio: int,
    trimestre: int,
    secretaria_nombre: str | None,
    fecha_auditoria: date | None = None,
) -> dict[str, str]:
    fecha = fecha_auditoria or date.today()
    meses = (
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    )
    fecha_fmt = f"{fecha.day:02d} de {meses[fecha.month - 1]} de {fecha.year}"
    sec = secretaria_nombre or "la dependencia con funciones de Control Interno"
    tri = trimestre_label(trimestre)

    return {
        "entity_name": entity_name,
        "entity_upper": entity_name.upper(),
        "anio": str(anio),
        "trimestre": tri,
        "trimestre_num": str(trimestre),
        "secretaria": sec,
        "fecha_auditoria": fecha_fmt,
        "anio_anterior": str(anio - 1),
    }


def introduccion(ctx: dict[str, str]) -> str:
    return (
        f"La Oficina de Control Interno, en cumplimiento de su rol de Evaluación y Seguimiento "
        f"establecido por el Decreto 1537 de 2001, que reglamenta parcialmente la Ley 87 de 1993, "
        f"y dando cumplimiento al Artículo 76 de la Ley 1474 de julio 12 de 2011: "
        f"\"La oficina de control interno deberá vigilar que la atención se preste de acuerdo con "
        f"las normas legales vigentes y rendirá a la administración de la entidad un informe semestral "
        f"sobre el particular\", y la Ley 1712 de 2014 por medio de la cual se crea la Ley de "
        f"Transparencia y Acceso a la Información Pública; programó dentro de su Plan Anual de "
        f"Auditorías (PAAI) vigencia {ctx['anio']} la realización de una auditoría de seguimiento al "
        f"cumplimiento del Decreto 612 de 2018, con enfoque en el {ctx['trimestre']} de la vigencia "
        f"{ctx['anio']}, bajo la responsabilidad de {ctx['secretaria']}."
        f"\n\n"
        f"Este informe se realiza con base en la revisión de la articulación del Plan de Acción "
        f"Institucional {ctx['anio']} publicado en la página web de {ctx['entity_name']}, el análisis "
        f"de la información recibida por correo electrónico a la Oficina de Control Interno, la "
        f"verificación en el portal web de la entidad sobre la publicación del informe de gestión del "
        f"año anterior para cada plan que trata el artículo 74 de la Ley 1474 de 2011, y lo encontrado "
        f"en entrevistas y observaciones de las actividades realizadas en el periodo auditado. "
        f"A partir de los resultados obtenidos, se presentan las principales recomendaciones dirigidas "
        f"a Alta Dirección y a los líderes de los procesos para su fortalecimiento."
    )


def objetivo_general(ctx: dict[str, str]) -> str:
    return (
        f"Realizar seguimiento y evaluación al cumplimiento del Decreto 612 de 2018 de "
        f"{ctx['entity_name']} correspondiente al {ctx['trimestre']} de la vigencia {ctx['anio']}."
    )


def objetivos_especificos(ctx: dict[str, str]) -> list[str]:
    return [
        f"Verificar la integración de los 12 planes institucionales y estratégicos en el Plan de Acción {ctx['anio']}.",
        f"Verificar la publicación del Informe de Gestión del año {ctx['anio_anterior']} conforme al artículo 74 de la Ley 1474 de 2011.",
        f"Evaluar el avance de las actividades programadas para el {ctx['trimestre']} de la vigencia {ctx['anio']}.",
    ]


def alcance(ctx: dict[str, str]) -> str:
    return (
        f"Se inicia con la verificación de la integración de los doce (12) planes en el Plan de Acción "
        f"Institucional {ctx['anio']}, con base en la información de la página web de {ctx['entity_name']}. "
        f"En caso de ser necesario, el grupo auditor ampliará el alcance a los funcionarios en los que se "
        f"detecte riesgo de incumplimiento. El seguimiento incluye las actividades del {ctx['trimestre']}. "
        f"Se finaliza con la revisión de otros documentos asociados y evidencias de cumplimiento. "
        f"El periodo objeto de auditoría es la vigencia {ctx['anio']}."
    )


def fecha_auditoria(ctx: dict[str, str]) -> str:
    return (
        f"El procedimiento de auditoría se realizó desde el {ctx['fecha_auditoria']} utilizando como "
        f"insumo la información publicada en la página web de {ctx['entity_name']} y los registros "
        f"del sistema de seguimiento a planes institucionales."
    )


def criterios_auditoria() -> str:
    return (
        "Decreto 612 de 2018; Artículo 2.8.2.5.8 Decreto 1080 de 2015; Artículo 2.2.1.1.1.4.3 del "
        "Decreto 1082 de 2015; Ley 909 de 2004 en el numeral 2, literales a) y b) del artículo 15 y "
        "en el numeral 1 del artículo 17; Decreto-ley 1567 de 1998 en el artículo 3° literal a y en "
        "el artículo 34; Decreto 1072 de 2015 en el artículo 2.2.4.6.8 numeral 7 c; Ley 1474 de 2011 "
        "en los artículos 73 y 74; Decreto 1078 de 2015 en el artículo 2.2.9.1.2.2."
    )


def tipo_auditoria() -> str:
    return "De seguimiento"
