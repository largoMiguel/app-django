"""Production settings."""
from .base import *  # noqa: F401, F403
from .base import env

DEBUG = False

ENABLE_DJANGO_ADMIN = env_bool("ENABLE_DJANGO_ADMIN", False)

SECRET_KEY = env("SECRET_KEY")
if SECRET_KEY == "django-insecure-change-me":
    raise RuntimeError("Configure una SECRET_KEY segura en producción.")

# Behind a reverse proxy (Nginx + Cloudflare Tunnel)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True
USE_X_FORWARDED_PORT = True

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_SSL_REDIRECT = False  # TLS terminates at Cloudflare; nginx serves HTTP internally

# Pool de conexiones: workers × threads del pool Gunicorn (gthread).
DATABASES["default"]["CONN_MAX_AGE"] = 120  # noqa: F405
DATABASES["default"]["OPTIONS"] = {  # noqa: F405
    **DATABASES["default"].get("OPTIONS", {}),  # noqa: F405
    "connect_timeout": 10,
    "options": "-c statement_timeout=60000",  # 60s máx por query
}
