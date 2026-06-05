# syntax=docker/dockerfile:1.7
FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential libpq5 curl gosu \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

RUN useradd -m -u 1000 appuser \
    && chown -R appuser:appuser /app \
    && chmod +x /app/docker-entrypoint.sh

# Entrypoint corre como root (chown volúmenes); gunicorn como appuser vía gosu.
USER root

ENV DJANGO_SETTINGS_MODULE=config.settings.prod
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=5 \
    CMD curl -fsS http://localhost:8000/api/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "-c", "gunicorn.conf.py"]
