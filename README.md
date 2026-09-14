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
4. Configura un ID de D1 local en `wrangler.jsonc` o usa el entorno local con la configuración por defecto.
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
