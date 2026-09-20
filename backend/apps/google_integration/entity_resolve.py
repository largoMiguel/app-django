"""Resolución de entidad por dominio de correo institucional."""
from __future__ import annotations

from apps.accounts.memberships import list_memberships
from apps.accounts.models import User
from apps.entities.models import Entity


def email_domain(address: str) -> str:
    addr = (address or "").strip().lower()
    if "@" not in addr:
        return ""
    return addr.split("@", 1)[1]


def entity_domains(entity: Entity) -> set[str]:
    domains: set[str] = set()
    raw = (getattr(entity, "email_domains", None) or "").strip()
    if raw:
        for part in raw.replace(";", ",").split(","):
            d = part.strip().lower()
            if d:
                domains.add(d)
    ent_email = (entity.email or "").strip().lower()
    if ent_email and "@" in ent_email:
        domains.add(ent_email.split("@", 1)[1])
    return domains


def entities_matching_domain(domain: str) -> list[Entity]:
    domain = domain.lower().strip()
    if not domain:
        return []
    matches: list[Entity] = []
    for entity in Entity.objects.filter(is_active=True):
        if domain in entity_domains(entity):
            matches.append(entity)
    return matches


def resolve_entity_for_google_user(user: User, google_email: str) -> Entity | None:
    """Entidad para Add-on: dominio del correo Google ∩ membresías activas."""
    domain = email_domain(google_email)
    memberships = list_memberships(user)
    membership_entity_ids = {m.entity_id for m in memberships}

    if domain:
        domain_entities = entities_matching_domain(domain)
        allowed = [e for e in domain_entities if e.id in membership_entity_ids]
        if len(allowed) == 1:
            return allowed[0]
        if len(allowed) > 1:
            return None

    defaults = [m for m in memberships if m.is_default]
    if len(defaults) == 1:
        return defaults[0].entity
    if len(memberships) == 1:
        return memberships[0].entity
    return None
