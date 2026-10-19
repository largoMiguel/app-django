# Baseline de rendimiento (pre-optimización integral)

Fecha: 2026-10-18. Servidor `softone` (192.168.88.2), Ryzen 7 8700G, 16 GB RAM.

## Host y contenedores

| Métrica | Valor |
|--------|--------|
| RAM usada | ~6,4 / 14 GiB |
| CPU EPP | performance |
| TCP | bbr |
| Gunicorn prod | 6 workers × 8 threads |
| Celery worker prod | ~1,49 GiB / 2 GiB |
| Celery worker demo | ~905 MiB / 1 GiB |
| Redis hit ratio (previo) | ~18 % (1965 hits / 8898 misses) |

## Frontend (post lazy routes, pre shell Copilot)

| Chunk | ~gzip |
|-------|--------|
| index | ~35 KB |
| react-vendor | (separado) |
| clerk / charts / excel / spline | manualChunks |

## Latencia (referencia migración)

| Ruta | LAN |
|------|-----|
| `/healthz` | ~0,6–3 ms |
| WAN TTFB | ~280–440 ms (dominado por Cloudflare) |

## Postgres

- `pg_stat_statements`: activado en compose (requiere `CREATE EXTENSION` tras reinicio de DB).
- Tablas más pobladas (aprox.): `ai_interactions`, `ai_content_embeddings`.

## Notas

Comparar tras el deploy: tamaños de chunks en build, `docker stats`, Redis `keyspace_hits/misses`, top queries en `pg_stat_statements`.
