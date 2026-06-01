"""Validación de rutas relativas bajo MEDIA_ROOT."""


def is_safe_media_relative_path(path: str) -> bool:
    """Rechaza traversal (../) sin bloquear nombres de archivo con '..' en el texto."""
    path = path.lstrip("/")
    if not path or path.startswith("/"):
        return False
    return ".." not in path.split("/")
