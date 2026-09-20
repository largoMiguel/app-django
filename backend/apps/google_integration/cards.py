"""Google Workspace Add-on Card JSON responses."""
from __future__ import annotations

from django.conf import settings
from typing import Any


def _app_base() -> str:
    base = (getattr(settings, "APP_PUBLIC_URL", "") or getattr(settings, "APP_BASE_URL", "") or "").strip()
    if base:
        return base.rstrip("/")
    return "https://app.softone360.com"


def card_response(*sections: dict[str, Any]) -> dict[str, Any]:
    return {
        "action": {"navigations": [{"pushCard": {"sections": list(sections)}}]},
    }


def card_update(*sections: dict[str, Any]) -> dict[str, Any]:
    return {"renderActions": {"action": {"navigations": [{"updateCard": {"sections": list(sections)}}]}}}


def section_header(title: str, subtitle: str = "") -> dict[str, Any]:
    widgets: list[dict[str, Any]] = [{"textParagraph": {"text": f"<b>{title}</b>"}}]
    if subtitle:
        widgets.append({"textParagraph": {"text": subtitle}})
    return {"header": title, "widgets": widgets}


def section_widgets(header: str, widgets: list[dict[str, Any]]) -> dict[str, Any]:
    return {"header": header, "widgets": widgets}


def button_text(text: str, function_name: str, parameters: list[dict[str, str]] | None = None) -> dict[str, Any]:
    action: dict[str, Any] = {
        "function": function_name,
    }
    if parameters:
        action["parameters"] = parameters
    return {
        "textButton": {
            "text": text,
            "onClick": {"action": action},
        }
    }


def open_card() -> dict[str, Any]:
    return card_response(
        section_header("Sistema PQRS", "Radique el correo abierto como PQRS en su entidad."),
        section_widgets(
            "Acción",
            [
                button_text("RADICAR COMO PQRS", "gmail/preview"),
            ],
        ),
    )


def preview_card(
    *,
    preview_token: str,
    tipo: str,
    asunto: str,
    nombre: str,
    email_ciudadano: str,
    secretaria_options: list[tuple[int, str]],
    secretaria_id: int | None,
) -> dict[str, Any]:
    widgets: list[dict[str, Any]] = [
        {"textInput": {"name": "tipo_solicitud", "label": "Tipo", "value": tipo}},
        {"textInput": {"name": "asunto", "label": "Asunto", "value": asunto}},
        {"textInput": {"name": "nombre_ciudadano", "label": "Ciudadano", "value": nombre or ""}},
        {"textInput": {"name": "email_ciudadano", "label": "Email ciudadano", "value": email_ciudadano or ""}},
    ]
    if secretaria_options:
        widgets.append(
            {
                "selectionInput": {
                    "name": "secretaria_id",
                    "label": "Secretaría",
                    "type": "DROPDOWN",
                    "items": [
                        {
                            "text": label,
                            "value": str(sid),
                            "selected": str(sid) == str(secretaria_id or ""),
                        }
                        for sid, label in secretaria_options
                    ],
                }
            }
        )
    widgets.append(
        button_text(
            "Confirmar radicación",
            "gmail/radicate",
            [{"key": "preview_token", "value": preview_token}],
        )
    )
    return card_update(
        section_header("Vista previa PQRS", "Revise y confirme antes de radicar."),
        section_widgets("Datos", widgets),
    )


def success_card(radicado: str, pqrs_id: int) -> dict[str, Any]:
    url = f"{_app_base()}/pqrs/{pqrs_id}"
    return card_update(
        section_header("✓ PQRS RADICADA", f"Radicado: <b>{radicado}</b>"),
        section_widgets(
            "Siguiente paso",
            [
                {
                    "openLink": {
                        "url": url,
                        "openAs": "FULL_SIZE",
                        "onClose": "NOTHING",
                    }
                },
                {"textParagraph": {"text": f'<a href="{url}">ABRIR EN SISTEMA</a>'}},
            ],
        ),
    )


def duplicate_card(radicado: str, pqrs_id: int) -> dict[str, Any]:
    url = f"{_app_base()}/pqrs/{pqrs_id}"
    return card_update(
        section_header("Este correo ya fue radicado", f"Radicado: <b>{radicado}</b>"),
        section_widgets("PQRS existente", [{"openLink": {"url": url}}]),
    )


def error_card(message: str) -> dict[str, Any]:
    return card_update(section_header("No se pudo completar", message))
