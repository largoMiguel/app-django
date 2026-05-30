"""Development settings."""
from .base import *  # noqa: F401, F403
from .base import env_list, env
import os

DEBUG = True
ALLOWED_HOSTS = ["*"]
CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)
CORS_ALLOW_ALL_ORIGINS = False

# Soporte para SQLite en desarrollo local (sin Docker)
if env("USE_SQLITE", False):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "db.sqlite3"),
        }
    }
