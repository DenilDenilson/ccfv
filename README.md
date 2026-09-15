# CCFV — Cine Club Federico Villarreal

Aplicación full-stack Astro para propuestas y votaciones de películas del CCFV. La primera implementación usa Astro SSR en Cloudflare Workers, D1/SQLite, Drizzle para el esquema, Tailwind CSS y consultas server-side hacia TMDB.

## Estado

La base funcional incluye:

- páginas mobile-first de inicio, rondas, miembros y propuestas;
- códigos de miembro con HMAC y sesiones revocables en D1;
- resolución de enlaces IMDb mediante TMDB, sin scraping;
- votos de miembros y votos públicos con una fila única por participante/ronda;
- protección inicial de cookies, CSRF, cabeceras, límites de tamaño y Cloudflare Access para administración;
- migración inicial y una prueba unitaria del parser IMDb.

El panel administrativo ya permite revisar propuestas, crear rondas, añadir candidatas, abrir/cerrar votaciones, finalizar resultados y marcar una película seleccionada. Antes de abrir una ronda pública real aún deben configurarse los recursos de Cloudflare, los secretos de producción, Turnstile adaptativo y el despliegue desde GitHub según `plan.md`.

## Desarrollo local

1. Instala Node.js 22+ y pnpm 9+.
2. Ejecuta `pnpm install`.
3. Copia `.dev.vars.example` a `.dev.vars` y reemplaza los secretos. No subas `.dev.vars`.
4. Para el entorno local no necesitas un ID remoto: `wrangler d1 --local` crea la base SQLite dentro de `.wrangler/`. Los IDs de `wrangler.jsonc` solo se reemplazan al preparar staging o producción.
5. Ejecuta `pnpm db:migrate:local`.
6. Crea un miembro de prueba con `pnpm db:seed:local -- "Bianca" "CCFV-TESTLOCAL20260000000000000"`.
7. Ejecuta `pnpm dev`.

En local, abre `/admin/login` y usa `LOCAL_ADMIN_SECRET`; el formulario crea una cookie administrativa temporal. También se acepta la cabecera `X-CCFV-Local-Admin` para llamadas de prueba. Ese acceso solo existe cuando `APP_ENV=local`; producción exige un JWT verificado de Cloudflare Access y una fila activa en `admin_principals`.

El miembro creado por el comando anterior puede entrar en `/miembros/ingresar` con el código indicado. El script solo guarda el hash del código en D1; el código se muestra en la terminal para la prueba.

## Comandos

```text
pnpm dev
pnpm check
pnpm test
pnpm build
pnpm db:migrate:local
```

Antes de una migración de staging o producción, revisa los IDs de D1 y ejecuta el workflow de CI/CD con el entorno correspondiente. Consulta `plan.md` para el roadmap, las decisiones abiertas, las políticas de retención y los criterios de aceptación.

## Staging y despliegue

Staging es una copia aislada de la aplicación, con el Worker `ccfv` y la base D1 `ccfv-staging`. Sirve para probar migraciones, Cloudflare Access, Turnstile y los flujos administrativos sin tocar la votación pública. Producción usa el Worker `ccfv-production`, el dominio real y los datos definitivos.

Para preparar los recursos una sola vez:

```text
pnpm exec wrangler d1 create ccfv-staging
pnpm exec wrangler d1 create ccfv-production
```

Copia cada `database_id` en el bloque correspondiente de `wrangler.jsonc` y cambia los dominios `PUBLIC_APP_ORIGIN`. Después configura en GitHub, dentro de los entornos `staging` y `production`, los secretos `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`, más la variable `TURNSTILE_SITE_KEY`.

Los secretos del Worker se cargan una vez por entorno con `wrangler secret put`, por ejemplo `TMDB_API_TOKEN`, `TURNSTILE_SECRET_KEY`, `MEMBER_CODE_HMAC_KEY`, `VISITOR_COOKIE_HMAC_KEY`, `CSRF_HMAC_KEY`, `CF_ACCESS_ISSUER` y `CF_ACCESS_AUDIENCE`. Nunca se escriben en `wrangler.jsonc`, GitHub Actions logs ni el repositorio. El workflow manual `.github/workflows/deploy.yml` compila con `CLOUDFLARE_ENV` para seleccionar el entorno de Astro 6, aplica migraciones con el `wrangler.jsonc` raíz y despliega el artefacto ya preparado. No añadas `--env` al comando final de deploy: en Astro 6 el entorno se decide en el build.
