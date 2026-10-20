"""Instala fuentes faltantes: embebidas en el .docx o descarga open-source (Fontsource)."""
from __future__ import annotations

import logging
import re
import subprocess
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

import requests
from django.conf import settings

from apps.common.docx_template import (
    _normalize_font_key,
    collect_requested_fonts,
    invalidate_fc_available_cache,
    missing_fonts,
)

logger = logging.getLogger(__name__)

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"

_EMBED_TAGS = ("embedRegular", "embedBold", "embedItalic", "embedBoldItalic")
_FONT_ID_RE = re.compile(r"[^a-z0-9-]+")
_FONTSOURCE_API = "https://api.fontsource.org/v1/fonts"
_FONTSOURCE_CDN = "https://cdn.jsdelivr.net/fontsource/fonts/{font_id}@latest/latin-400-normal.ttf"


def custom_font_dir() -> Path:
    path = Path(getattr(settings, "DOCX_CUSTOM_FONT_DIR", settings.BASE_DIR / "data" / "fonts"))
    path.mkdir(parents=True, exist_ok=True)
    return path


def _deobfuscate_font(data: bytes, font_key: str) -> bytes | None:
    hex_key = re.sub(r"[^0-9a-fA-F]", "", font_key)
    if len(hex_key) != 32:
        return None
    key = bytes.fromhex(hex_key)[::-1]
    prefix = bytearray(data[:32])
    for i in range(min(32, len(prefix))):
        prefix[i] ^= key[i % 16]
    return bytes(prefix) + data[32:]


def _parse_font_table_rels(zf: ZipFile) -> dict[str, str]:
    try:
        root = ET.fromstring(zf.read("word/_rels/fontTable.xml.rels"))
    except KeyError:
        return {}
    rels: dict[str, str] = {}
    for rel in root:
        if not rel.tag.endswith("Relationship"):
            continue
        rel_id = rel.get("Id")
        target = rel.get("Target")
        if rel_id and target:
            rels[rel_id] = target.lstrip("/")
    return rels


def extract_embedded_fonts(docx_bytes: bytes) -> dict[str, bytes]:
    """Extrae fuentes embebidas del .docx (odttf deofuscado o ttf directo)."""
    out: dict[str, bytes] = {}
    with ZipFile(BytesIO(docx_bytes)) as zf:
        if "word/fontTable.xml" not in zf.namelist():
            return out
        rels = _parse_font_table_rels(zf)
        try:
            root = ET.fromstring(zf.read("word/fontTable.xml"))
        except ET.ParseError:
            return out

        for font_el in root.iter(f"{{{W_NS}}}font"):
            family = font_el.get(f"{{{W_NS}}}name")
            if not family:
                continue
            for tag in _EMBED_TAGS:
                embed = font_el.find(f"{{{W_NS}}}{tag}")
                if embed is None:
                    continue
                rel_id = embed.get(f"{{{REL_NS}}}id")
                font_key = embed.get(f"{{{W_NS}}}fontKey")
                if not rel_id or rel_id not in rels:
                    continue
                target = rels[rel_id]
                zip_path = target if target.startswith("word/") else f"word/{target}"
                try:
                    raw = zf.read(zip_path)
                except KeyError:
                    logger.warning("Fuente embebida no encontrada en %s", zip_path)
                    continue
                if zip_path.endswith(".odttf") and font_key:
                    decoded = _deobfuscate_font(raw, font_key)
                    if decoded is None:
                        continue
                    raw = decoded
                if family not in out:
                    out[family.strip()] = raw
                break
    return out


def _font_file_path(family: str) -> Path:
    slug = _FONT_ID_RE.sub("-", _normalize_font_key(family)).strip("-") or "font"
    return custom_font_dir() / f"{slug}.ttf"


def _install_font_bytes(family: str, data: bytes) -> bool:
    if len(data) < 256:
        return False
    dest = _font_file_path(family)
    if dest.is_file() and dest.stat().st_size >= 256:
        return False
    dest.write_bytes(data)
    logger.info("Fuente instalada: %s → %s", family, dest)
    return True


def _run_fc_cache() -> None:
    font_dir = str(custom_font_dir())
    try:
        subprocess.run(
            ["fc-cache", "-f", font_dir],
            check=False,
            capture_output=True,
            timeout=120,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        logger.warning("fc-cache no disponible; fontconfig puede no ver fuentes nuevas")
    invalidate_fc_available_cache()


def _fontsource_candidates(family: str) -> list[str]:
    base = family.strip().lower()
    candidates = [
        _FONT_ID_RE.sub("-", base.replace(" ", "-")),
        _FONT_ID_RE.sub("", base.replace(" ", "")),
        _FONT_ID_RE.sub("-", base.replace(" ", "")),
    ]
    seen: set[str] = set()
    ordered: list[str] = []
    for c in candidates:
        if c and c not in seen:
            seen.add(c)
            ordered.append(c)
    return ordered


def _download_from_fontsource(family: str) -> bytes | None:
    timeout = int(getattr(settings, "DOCX_FONT_DOWNLOAD_TIMEOUT", 30))
    headers = {"User-Agent": "softone-docx-font-install/1.0"}
    for font_id in _fontsource_candidates(family):
        meta_url = f"{_FONTSOURCE_API}/{font_id}"
        try:
            meta_resp = requests.get(meta_url, timeout=timeout, headers=headers)
        except requests.RequestException:
            logger.debug("Fontsource meta falló para %s", font_id, exc_info=True)
            continue
        if meta_resp.status_code != 200:
            continue
        try:
            meta = meta_resp.json()
        except ValueError:
            continue
        api_family = (meta.get("family") or "").strip()
        if api_family and _normalize_font_key(api_family) != _normalize_font_key(family):
            if _normalize_font_key(family) not in _normalize_font_key(api_family):
                continue
        ttf_url = _FONTSOURCE_CDN.format(font_id=font_id)
        try:
            ttf_resp = requests.get(ttf_url, timeout=timeout, headers=headers)
        except requests.RequestException:
            logger.debug("Fontsource TTF falló para %s", font_id, exc_info=True)
            continue
        if ttf_resp.status_code == 200 and len(ttf_resp.content) >= 256:
            return ttf_resp.content
    return None


@dataclass
class FontInstallResult:
    installed: list[str]
    still_missing: list[str]


def ensure_fonts_for_docx(
    docx_bytes: bytes,
    requested: set[str] | None = None,
) -> FontInstallResult:
    """
    Instala fuentes que falten: primero las embebidas en el Word, luego descarga open-source.
    Idempotente si los archivos .ttf ya existen en DOCX_CUSTOM_FONT_DIR.
    """
    requested_set = set(requested) if requested is not None else collect_requested_fonts(docx_bytes)
    if not requested_set:
        return FontInstallResult(installed=[], still_missing=[])

    installed: list[str] = []
    cache_updated = False

    for family, font_bytes in extract_embedded_fonts(docx_bytes).items():
        if _install_font_bytes(family, font_bytes):
            installed.append(family)
            cache_updated = True

    if cache_updated:
        _run_fc_cache()

    for family in missing_fonts(requested_set):
        if not getattr(settings, "DOCX_AUTO_INSTALL_FONTS", True):
            break
        payload = _download_from_fontsource(family)
        if payload and _install_font_bytes(family, payload):
            installed.append(family)
            _run_fc_cache()

    still = missing_fonts(requested_set)
    return FontInstallResult(installed=sorted(installed, key=str.lower), still_missing=still)
