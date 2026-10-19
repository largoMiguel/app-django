# Cloudflare — reglas recomendadas (manual)

Tras el deploy con fuentes locales y modelos face-api:

1. **Cache Rules**
   - `/assets/*` — ya immutable en origen; Edge TTL coherente con Tiered Cache.
   - `/models/*` y `/fonts/*` (si se sirven bajo esas rutas) — **Cache Everything**, Edge TTL **1 year**.
   - `/api/*` — **Bypass cache** (obligatorio).

2. **Speed**
   - Brotli: **On**
   - Early Hints: **On** (ya activo)
   - HTTP/3: **On**

3. **Verificación**
   - `curl -I https://app.softone360.com/assets/` debe mostrar `cf-cache-status` distinto de BYPASS en estáticos.
   - `curl -I https://app.softone360.com/api/v1/health/` debe ser BYPASS o DYNAMIC.
