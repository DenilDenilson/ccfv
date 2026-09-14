# Plan de implementación — CCFV

Documento de planificación. No contiene implementación. Inspección del proyecto: 13 de septiembre de 2026, hora de Lima.

La carpeta de trabajo está vacía: no hay aplicación, dependencias, archivos de configuración, instrucciones AGENTS.md aplicables ni repositorio Git inicializado. La propuesta parte de cero y respeta el stack solicitado. Las versiones exactas se fijarán juntas en MVP 0, después de comprobar su compatibilidad; no se presupone que ejemplos antiguos de Astro o Drizzle sigan vigentes.

Las recomendaciones de producto de este documento son valores iniciales explícitos. Las que requieren acuerdo del CCFV aparecen en **18. Decisiones abiertas**, con el momento en que deben resolverse. El siguiente agente debe comenzar por MVP 0, sin construir todo el roadmap a la vez.

## 1. Visión del producto

Ayudar al Cine Club Federico Villarreal a decidir futuras proyecciones mediante propuestas revisadas y rondas de votación. El producto responde dos preguntas diferentes: qué prefieren los miembros y qué interesa al público. Ambas señales se presentan por separado y la selección final corresponde a los organizadores.

La unidad central es una **ronda de votación**, con tema, candidatas y fechas. Una película no tiene un estado global de «votada» o «proyectada»: puede proponerse, participar en distintas rondas y proyectarse más de una vez.

El éxito inicial consiste en completar una ronda real sin recurrir a hojas de cálculo para consolidar votos, y en que alguien que llega desde Instagram pueda votar sin registrarse. No se pretende construir una red social ni una elección formal con identidad pública verificada.

## 2. Alcance

### Incluido hasta MVP 2

- Catálogo mínimo de películas obtenido mediante IMDb ID y TMDB.
- Acceso de miembros mediante códigos personales, sesiones y revocación.
- Propuestas con justificación opcional y revisión administrativa.
- Rondas con candidatas elegidas por administradores.
- Elección de una película por ronda, modificable mientras esté abierta.
- Participaciones de miembros y público en tablas y resultados independientes.
- Administración de miembros, propuestas, rondas, resultados y señales de abuso.
- Registro mínimo de selección, programación y proyección.
- Pruebas, registros operativos, migraciones y despliegue reproducible.

### Excluido inicialmente

Perfiles sociales, seguidores, comentarios generales, mensajes, estrellas personales, badges, gamificación, listas privadas, recomendaciones algorítmicas, notificaciones por correo, ponderación de votos, rankings preferenciales, CMS, subida de fotografías y archivo editorial público completo. Tampoco se incluye reserva de entradas, pagos ni reproducción de películas.

No se agregan React, otro backend, Redis, colas, WebSockets, almacenamiento de objetos ni servicios de búsqueda al MVP sin una necesidad demostrada. Cloudflare Access es un servicio de autenticación recomendado para organizadores, no una aplicación backend adicional.

## 3. Roles

| Capacidad | Público | Miembro activo | Administrador autorizado |
| --- | --- | --- | --- |
| Ver rondas públicas y candidatas | Sí | Sí | Sí |
| Ver rondas internas | No | Sí | Sí |
| Votar | Voto público en ronda pública | Voto de miembro | Solo con identidad de miembro adicional, o como público donde corresponda |
| Cambiar su voto abierto | Sí | Sí | Igual que su identidad participante |
| Proponer películas | No | Sí | Mediante identidad de miembro en MVP |
| Ver sus propuestas y su revisión | No | Sí | Puede revisar todas |
| Aprobar, rechazar y organizar rondas | No | No | Sí |
| Ver resultados durante la votación | No, por defecto | No, por defecto | Sí, separados |
| Gestionar miembros y códigos | No | No | Sí |
| Excluir votos públicos abusivos con motivo | No | No | Sí, antes de finalizar resultados |

Un miembro desactivado pierde acceso autenticado. Sus votos anteriores no desaparecen automáticamente. No existe un campo administrativo en el código del miembro: autenticación de organizadores y pertenencia al cineclub son conceptos independientes.

Se propone un único permiso administrativo inicialmente. No construir un motor de roles. La aplicación debe comprobar la autorización en cada operación de servidor, aunque la pantalla o el enlace estén ocultos.

## 4. Flujos principales

### 4.1 Público

1. Abre un enlace directo a `/rondas/[slug]` desde Instagram.
2. Ve el tema, fecha de cierre, candidatas y una instrucción: «Elige una película. Puedes cambiar tu elección hasta el cierre».
3. El servidor establece o recupera su identificador anónimo mediante cookie.
4. Selecciona una candidata y pulsa «Votar».
5. El servidor valida ronda, candidata, identidad anónima, CSRF y señales de abuso. Solicita Turnstile si hace falta.
6. Guarda una participación o actualiza la existente y confirma la película elegida.
7. Puede regresar y cambiarla mientras continúe abierta. Al cerrar, ve su elección y el estado de la ronda.

La visita no cuenta como voto. No hay login público. Un error de red no debe mostrar una confirmación falsa ni obligar a crear otra participación.

### 4.2 Miembro

1. Entra en `/miembros/ingresar`, introduce su código y obtiene una sesión.
2. El servidor muestra su nombre de uso y las opciones «Proponer» y «Mis propuestas».
3. Pega un enlace IMDb en el formulario de propuesta.
4. El backend resuelve el IMDb ID en TMDB y devuelve una vista previa.
5. Confirma la película, agrega hasta 500 caracteres de justificación opcional y envía.
6. La propuesta queda pendiente; el miembro puede consultar su estado.
7. Vota en una ronda. El servidor toma su identidad de la sesión, nunca del formulario.

Ingresar un código no emite ni cambia votos por sí mismo. Al expirar una sesión, se explica la situación antes de continuar; no se transforma silenciosamente un envío de miembro en voto público.

### 4.3 Organizador

1. Accede al panel mediante autenticación administrativa independiente.
2. Revisa propuestas pendientes y aprueba o rechaza con motivo.
3. Crea una ronda en borrador, define fechas y audiencia, y agrega películas aprobadas.
4. Revisa la vista previa; publica para apertura programada o abre en ese momento.
5. Consulta participación y resultados separados. Puede cerrar anticipadamente.
6. Tras el cierre, revisa señales públicas pendientes y finaliza los resultados.
7. Selecciona una película, registrando el criterio si hay empate o si no elige la más votada por miembros.
8. Publica resultados cuando corresponda, programa una fecha y posteriormente registra la proyección.

### 4.4 Estados del proceso

| Paso del negocio | Representación |
| --- | --- |
| Propuesta / revisión | `proposals.status = pending` |
| Candidata aprobada | `proposals.status = approved`; disponible para curaduría |
| Rechazada | `proposals.status = rejected`, con motivo |
| Incluida en ronda | Relación `round_movies` |
| Votación futura / abierta | Ronda publicada y estado efectivo calculado con sus fechas |
| Cerrada | Cierre manual o llegada de la fecha límite |
| Resultados definitivos | `results_finalized_at` y fotografía de conteos por candidata |
| Seleccionada | `round_movies.selected_at`, responsable y motivo |
| Programada / proyectada | Registro separado en `screenings` |

Aprobar una propuesta no la introduce en una ronda. Cerrar una ronda no selecciona automáticamente una ganadora. Una propuesta rechazada puede volver a revisión mediante una acción administrativa auditada; se conserva su identidad original.

## 5. Decisiones de UX

- **Mobile-first:** tarjetas legibles, botones grandes, navegación mínima y una columna en pantallas pequeñas. Comprobar desde 360 px, zoom y orientación horizontal.
- **Una elección:** control de selección única accesible por candidata y un botón explícito de envío. Seleccionar una tarjeta todavía no guarda el voto.
- **Estado visible:** distinguir «Tu elección guardada» de una selección aún sin enviar. Al modificar, usar «Cambiar mi voto» y confirmar el resultado del servidor.
- **Películas:** póster, título, año y director; sinopsis y duración accesibles sin abandonar la ronda. Póster ausente no bloquea la interacción.
- **Pocas candidatas:** recomendación de 2 a 12 por ronda. Orden editorial fijo, sin ordenar por votos durante la votación.
- **Fechas:** almacenar UTC, editar y mostrar en `America/Lima`, incluyendo fecha y hora; la cuenta regresiva es informativa.
- **Resultados:** administradores ven datos en vivo. Público y miembros ven resultados cuando estén finalizados y publicados. No enviar conteos ocultos dentro del HTML o JSON.
- **Sin ambigüedad entre grupos:** indicar «Estás votando como miembro CCFV» cuando exista sesión. En resultados, columnas «Miembros CCFV» e «Interés del público», con totales independientes.
- **Propuestas:** nombre del proponente visible para él y administradores; oculto a otros miembros y al público inicialmente. Justificaciones solo se publican si un organizador decide utilizarlas como texto editorial.
- **Navegación:** inicio con próximas rondas; enlace directo a cada ronda; acceso discreto para miembros. El formulario administrativo queda fuera de la navegación pública principal.
- **Accesibilidad:** formularios HTML, etiquetas, foco visible, mensajes asociados al campo, estado anunciado por lector de pantalla, contraste suficiente y selección no dependiente del color.
- **Mejora progresiva:** formularios funcionales sin hidratación general. JavaScript pequeño para vista previa, feedback y desafío. Si se exige Turnstile, explicar la necesidad de habilitar JavaScript sin perder la selección.
- **Errores:** mensajes concretos para enlace inválido, película no encontrada, duplicado, sesión vencida, ronda cerrada y límite temporal. Conservar la justificación tras errores recuperables.
- **Enlaces sociales:** metadatos Open Graph de la ronda sin datos de sesión. Probar manualmente el navegador integrado de Instagram; su almacenamiento puede ser diferente al navegador habitual.
- **Transparencia:** aviso breve de cookie funcional y de que el voto público mide interés aproximado. No añadir analítica de marketing al MVP.

## 6. Arquitectura

### 6.1 Aplicación única

Un proyecto Astro con TypeScript estricto, Tailwind y renderizado de servidor para páginas dinámicas. Páginas informativas pueden prerenderizarse. Workers sirve recursos estáticos y ejecuta páginas y endpoints; D1 guarda los datos; TMDB y Turnstile se consultan desde servidor donde corresponda.

El adaptador oficial permite ejecutar las funciones de servidor de Astro en Cloudflare. Usar el acceso a bindings y el proceso de build de la versión instalada; evitar copiar recetas antiguas de `Astro.locals.runtime`. La compatibilidad se verificará en MVP 0. [Adaptador Cloudflare de Astro](https://docs.astro.build/en/guides/integrations-guide/cloudflare/).

**Elección de transporte para el MVP: endpoints Astro.** Formularios con POST y patrón POST/Redirect/GET; respuestas JSON para la mejora progresiva cuando sea útil. Esto permite proteger `/api/admin/*` con reglas claras de Access. Zod valida entradas y contratos externos. No exponer dos implementaciones de la misma operación.

Astro Actions es una alternativa válida si después reduce complejidad. Si se introduce, sus handlers deben usar las mismas funciones de dominio y autorización. Sus URLs también son accesibles directamente; proteger solo `/admin` no basta. [Seguridad de Astro Actions](https://docs.astro.build/en/guides/actions/#security-when-using-actions).

Drizzle define el esquema y consultas parametrizadas mediante su driver D1. Para una operación que necesite SQL condicional no expresable cómodamente en el ORM, admitir SQL parametrizado dentro del repositorio. [Drizzle y Cloudflare D1](https://orm.drizzle.team/docs/sqlite/connect-cloudflare-d1).

### 6.2 Responsabilidades y carpetas previstas

Árbol orientativo para la implementación futura; no crear estos archivos durante esta etapa:

```text
src/
  pages/
    index.astro
    rondas/[slug].astro
    miembros/ingresar.astro
    miembros/index.astro
    miembros/proponer.astro
    miembros/propuestas.astro
    admin/                         # páginas de propuestas, rondas y miembros
    api/
      miembros/                    # ingresar, salir, proponer, resolver IMDb
      rondas/[id]/voto.ts           # identidad participante resuelta en servidor
      admin/                       # operaciones administrativas
      health.ts                    # respuesta mínima, sin secretos ni diagnóstico interno
  components/                      # MovieCard, VoteForm, RoundStatus y componentes pequeños
    admin/
  layouts/
  lib/
    db/
      schema.ts
      client.ts
      repositories/                # miembros, películas, propuestas, rondas y votos
    auth/                          # códigos, sesiones, Access, autorización y CSRF
    tmdb/                          # cliente, parser IMDb y normalización
    antiabuse/                     # cookie anónima, límites y Turnstile
    voting.ts                      # invariantes y coordinación de votaciones
    proposals.ts                   # resolución y revisión de propuestas
    admin.ts                       # transiciones administrativas y auditoría
    validation.ts
    observability.ts
  styles/global.css
  middleware.ts
  env.d.ts
drizzle/                           # migraciones SQL versionadas y metadatos del generador
tests/
  unit/
  integration/
  e2e/
  fixtures/
scripts/                           # tareas operativas concretas, cuando se necesiten
.github/workflows/
astro.config.mjs
drizzle.config.ts
wrangler.jsonc
plan.md
```

Mantener módulos pequeños; no añadir capas de interfaces, contenedores de dependencias ni repositorios genéricos. Los endpoints validan HTTP, obtienen identidad y llaman funciones compartidas; las páginas no duplican reglas de negocio. `middleware` prepara contexto y defensas generales, pero cada mutación vuelve a exigir el permiso concreto.

### 6.3 Consistencia y caché

- Las decisiones de voto y autorización se leen de D1, sin caché de permisos.
- No activar replicación de lecturas en el MVP. Si se introduce después, revisar consistencia tras escritura y revocación con la API de sesiones de D1, que es distinta de una sesión de usuario.
- Páginas con cookie, elección propia, formularios o datos administrativos: `Cache-Control: private, no-store`. Nunca cachear una respuesta con `Set-Cookie` en caché compartida.
- Cachear únicamente recursos estáticos y metadatos de películas no personalizados. Leer resultados actuales mediante consultas, sin contadores incrementados por el cliente.
- Las llamadas a TMDB o Turnstile se completan antes de la escritura crítica; no mantener una supuesta transacción abierta mientras se espera una red externa.

## 7. Modelo de datos

### 7.1 Convenciones

IDs internos opacos de tipo texto generados en servidor; timestamps enteros en segundos UTC; textos con límites validados; valores de estado protegidos por `CHECK`, además de TypeScript y Zod. `NOT NULL` por defecto, indicando los campos anulables. Booleanos representados como enteros con restricción 0/1 cuando se necesiten.

Las relaciones importantes se declaran como claves foráneas reales. D1 aplica claves foráneas; comprobarlas también al ejecutar migraciones y pruebas. No depender exclusivamente de las relaciones declarativas del ORM. [Claves foráneas en D1](https://developers.cloudflare.com/d1/sql-api/foreign-keys/).

Preferir `ON DELETE RESTRICT` para miembros, propuestas, películas, rondas y resultados históricos. Desactivar o cancelar mediante estados. No borrar votos en cascada al desactivar una persona. Las sesiones son desechables y pueden eliminarse por mantenimiento.

### 7.2 Entidades

| Tabla | Campos principales | Relaciones, restricciones e índices |
| --- | --- | --- |
| `members` | `id`, `display_name`, `status` active/disabled, `code_hash` anulable, `code_key_version`, `auth_version`, `code_rotated_at`, `created_at`, `updated_at`, `disabled_at` anulable | PK `id`; UNIQUE `code_hash`; índice `(status, display_name)`. El nombre no es único. Miembro activo requiere hash; no guarda email, contraseña ni rol de administrador. |
| `member_sessions` | `id`, `member_id`, `token_hash`, `auth_version`, `created_at`, `last_seen_at`, `expires_at`, `revoked_at` anulable | FK a `members`; UNIQUE `token_hash`; índices `member_id` y `expires_at`; expiración posterior a creación. El token original solo está en cookie. |
| `admin_principals` | `id`, `access_issuer`, `access_subject`, `display_name`, `status` active/disabled, `created_at`, `updated_at` | UNIQUE `(access_issuer, access_subject)`; índice `status`. Lista local de organizadores habilitados; sin contraseña y sin FK obligatoria a miembros. |
| `movies` | `id`, `tmdb_id`, `imdb_id`, `title`, `original_title`, `release_date` anulable, `release_year` anulable, `poster_path` anulable, `overview` anulable, `runtime_minutes` anulable, `directors_json`, `metadata_language`, `metadata_fetched_at`, `created_at`, `updated_at` | UNIQUE `tmdb_id`; UNIQUE `imdb_id`; índices de los identificadores ya cubiertos por UNIQUE. IDs externos obligatorios en este flujo; duración positiva o NULL; año derivado de fecha cuando exista. JSON pequeño de nombres e IDs TMDB de directores, sin tabla de personas. |
| `proposals` | `id`, `movie_id`, `member_id`, `justification` anulable, `status` pending/approved/rejected, `reviewed_by` anulable, `reviewed_at` anulable, `review_reason` anulable, `created_at`, `updated_at` | FK a película, miembro y administrador revisor; UNIQUE `movie_id` en MVP; índices `(status, created_at)` y `(member_id, created_at)`. Rechazo requiere motivo. |
| `voting_rounds` | `id`, `slug`, `title`, `description`, `status` draft/published/closed/cancelled, `audience` members/members_and_public, `starts_at`, `ends_at`, `published_at` anulable, `closed_at` anulable, `public_key_version`, `results_finalized_at` anulable, `results_published_at` anulable, `created_by`, `updated_by`, `created_at`, `updated_at` | UNIQUE `slug`; FK de responsables a administradores; CHECK `ends_at > starts_at`; índices `(status, starts_at, ends_at)` y `(audience, status)`. Publicar resultados exige finalizarlos primero. |
| `round_movies` | `round_id`, `movie_id`, `added_by`, `added_at`, `position`, `selected_at` anulable, `selected_by` anulable, `selection_reason` anulable | PK compuesta `(round_id, movie_id)`; FKs a ronda, película y administradores. Índice `(round_id, position)`. Índice UNIQUE parcial sobre `round_id` cuando `selected_at` no es NULL: una seleccionada por ronda en MVP. |
| `member_votes` | `id`, `round_id`, `member_id`, `movie_id`, `created_at`, `updated_at` | UNIQUE **`(round_id, member_id)`**; FK a miembro; FK compuesta **`(round_id, movie_id)` a `round_movies`**; índice `(round_id, movie_id)`. Todos los campos de identidad son NOT NULL. |
| `public_votes` | `id`, `round_id`, `voter_key`, `movie_id`, `status` counted/excluded, `exclusion_reason` anulable abuse/member_conversion, `flagged_at` anulable, `flag_reason` anulable, `reviewed_by` anulable, `reviewed_at` anulable, `review_reason` anulable, `created_at`, `updated_at` | UNIQUE **`(round_id, voter_key)`**; FK compuesta **`(round_id, movie_id)` a `round_movies`**; FK de revisor a administrador; índices `(round_id, movie_id, status)` y `(round_id, flagged_at)`. Excluido requiere motivo. La identidad no es una IP. |
| `round_movie_results` | `round_id`, `movie_id`, `member_count`, `public_received_count`, `public_counted_count`, `public_abuse_excluded_count`, `public_converted_count` | PK `(round_id, movie_id)` y FK compuesta a `round_movies`; conteos enteros no negativos. Recibidos = contabilizados + excluidos por abuso + convertidos a miembro. Se genera una vez al finalizar; incluye candidatas con cero votos. |
| `screenings` | `id`, `movie_id`, `source_round_id` anulable, `status` scheduled/screened/cancelled, `scheduled_at`, `screened_at` anulable, `venue` anulable, `notes` anulable, `created_by`, `updated_by`, `created_at`, `updated_at` | FK a película y administradores; FK compuesta `(source_round_id, movie_id)` a `round_movies`, si hay ronda. Índice `(status, scheduled_at)`; UNIQUE `(movie_id, scheduled_at)` para evitar una función idéntica accidental. Proyectada exige fecha real. |
| `audit_events` | `id`, `admin_id` anulable, `actor_type` admin/system, `event_type`, `entity_type`, `entity_id`, `reason` anulable, `safe_metadata_json`, `request_id`, `created_at` | FK de administrador; índices `(entity_type, entity_id, created_at)` y `created_at`. El JSON tiene un esquema permitido; nunca cuerpos completos, códigos ni cookies. Eventos de sistema se distinguen explícitamente. |
| `abuse_events` — MVP 2 | `id`, `round_id` anulable, `public_vote_id` anulable, `signal_type`, `action_taken`, `ip_hmac` anulable, `ip_key_period` anulable, `request_id`, `created_at`, `expires_at` | FKs a ronda y voto público cuando existan; índices `(round_id, created_at)`, `(ip_hmac, created_at)` y `expires_at`. Sin IP original; retención corta y volumen acotado. |

Los checks que dependen de otras filas, como «película aprobada» o «ronda abierta», no son simples `CHECK` locales. Se ejecutan en las escrituras condicionales del repositorio y se prueban contra D1. Si hicieran falta triggers, deben ser pocos, estar en migraciones y tener pruebas directas; no crear un motor de reglas en SQL.

### 7.3 Restricciones esenciales

1. **No usar `(round_id, member_id, movie_id)` como única barrera contra duplicados:** permitiría al mismo miembro votar por varias candidatas. La unicidad es miembro + ronda.
2. Lo mismo aplica al público: identidad anónima + ronda, sin película en la clave UNIQUE.
3. La FK compuesta impide guardar un voto por una película que existe pero no pertenece a esa ronda. Dos FKs independientes a ronda y película no bastan.
4. Cambiar el voto conserva `id` y `created_at`, actualiza `movie_id` y `updated_at`, y mantiene una única fila.
5. Un duplicado de película se detecta por IDs externos, no por título. Una segunda propuesta del mismo filme encuentra la existente incluso si procede de otro miembro.
6. Una película aprobada puede estar en varias rondas. Las candidatas y fechas quedan congeladas al publicar, salvo apertura anticipada explícita y cierre anticipado.
7. No se elimina una candidata desde que se publica la ronda. Ante un error editorial grave, cancelar y crear otra ronda, dejando trazabilidad.
8. La selección y programación requieren una ronda efectivamente cerrada y resultados finalizados. La selección puede corregirse con motivo antes de programar; no mueve votos.

### 7.4 Duplicación de propuestas

Recomendación MVP: una propuesta canónica por película, con UNIQUE `movie_id`. Si ya existe, devolver su estado y una explicación; no registrar un apoyo adicional ni revelar su autor a otras personas. El primer proponente conserva la autoría interna. Los rechazos pueden reabrirse administrativamente con motivo, sin crear otra fila.

Esto sacrifica contar apoyos previos a una ronda a cambio de simplicidad. La evolución sería `proposal_supports` con UNIQUE `(proposal_id, member_id)`, o propuestas por convocatoria si el CCFV las necesita; ninguno de esos apoyos debe convertirse en votos automáticamente.

### 7.5 Base para Archivo CCFV

`screenings` permite repetir una película en fechas distintas, vincularla con una ronda o registrar posteriormente una función histórica sin ronda. `round_movie_results` conserva los conteos que sirvieron para decidir, aunque se eliminen datos individuales por retención.

Más adelante se pueden agregar ciclos, contenido editorial y una tabla de archivos vinculada a `screenings`, con objetos en R2. Flyers y fotografías no se almacenan como blobs en D1. No crear todavía esas tablas ni una interfaz de carga. Una selección es una decisión; una proyección es un evento y no debe depender de un único estado en `movies`.

### 7.6 Información que no almacenar

Códigos en texto plano o recuperables; tokens originales de sesión; contraseñas de miembros; IPs originales; fingerprint del dispositivo; historial de navegación; contactos del público; usuario completo de TMDB; respuestas completas innecesarias de terceros; tokens Turnstile; secretos en auditoría; snapshots con nombres de votantes. El voto de miembro es identificable en servidor, pero su elección individual no se expone en el panel ordinario.

## 8. Autenticación y sesiones

### 8.1 Códigos de miembros

- Generar al menos **128 bits aleatorios mediante CSPRNG/Web Crypto**, codificados con un alfabeto legible y agrupados para copiar. El prefijo CCFV y una versión de formato no aportan entropía. Los ejemplos de cinco caracteres del encargo son conceptuales y no deben usarse como longitud real.
- Propuesta: prefijo, versión y 26 caracteres Base32 derivados de 128 bits aleatorios. El código se puede pegar, sin distinguir mayúsculas ni separadores documentados. Rechazar otras normalizaciones ambiguas.
- Guardar exclusivamente un **HMAC-SHA-256 del código normalizado**, con una clave secreta externa a D1 y versión de clave. Es un hash con clave, no cifrado reversible. Su índice UNIQUE permite localizar directamente al miembro sin recorrer todos los hashes.
- Este enfoque se elige para secretos aleatorios de alta entropía. Si se permiten códigos cortos o elegidos por personas, hay que rediseñar el mecanismo; un hash rápido no vuelve seguro un código débil. No usar un hash de contraseña costoso como excusa para conservar cinco caracteres.
- Mostrar el código completo una sola vez al crearlo/regenerarlo, en una respuesta `no-store`. No incluirlo en URL, registros, trazas, capturas E2E con datos reales ni respuestas posteriores.
- La entrega y la verificación de identidad ocurren fuera de la aplicación, por un canal acordado del CCFV. No hay recuperación automática por nombre ni por correo.
- Si se pierde la respuesta tras generar el código, regenerarlo; el sistema no puede volver a mostrar el anterior.
- Regenerar incrementa `auth_version`, reemplaza el hash y revoca las sesiones anteriores en una operación atómica. Desactivar también invalida sesiones. Reactivar exige emitir un código nuevo, sin resucitar credenciales antiguas.
- Mantener claves de hash versionadas mientras haya códigos que dependan de ellas. Una rotación urgente por compromiso implica regenerar los códigos afectados; no es posible recalcular hashes sin conocer los códigos.

### 8.2 Inicio y mantenimiento de sesión

1. Validar formato, tamaño, origen y CSRF; aplicar límites antes del trabajo de autenticación.
2. Calcular el hash con la versión correspondiente y buscar un miembro activo.
3. Ante código desconocido, desactivado o inválido, devolver un mensaje genérico sin confirmar nombres ni existencia. No registrar el código enviado.
4. Generar un token de sesión nuevo de 256 bits; almacenar su SHA-256 y vincularlo a `member_id` y `auth_version`.
5. Crear la sesión solo si el miembro sigue activo y conserva la misma versión de autenticación dentro de la escritura de DB. Esto evita una carrera con la regeneración del código.
6. Usar cookie `__Host-ccfv_member`: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, sin `Domain`. No guardar credenciales en localStorage.
7. Propuesta inicial: máximo absoluto de 30 días y expiración por 14 días de inactividad. El servidor verifica ambos plazos; la cookie nunca amplía el máximo absoluto. Actualizar actividad como máximo cada cinco minutos y de forma monotónica para reducir escrituras.
8. En cada operación autenticada comprobar sesión, revocación, vencimiento, miembro activo y coincidencia de `auth_version`. Las mutaciones críticas repiten la condición en la escritura de DB.
9. «Cerrar sesión» revoca la sesión actual y elimina su cookie. «Cerrar todas las sesiones» invalida todas las del miembro. Regenerar el código también las invalida.

Se admiten varios dispositivos con sesiones diferentes y una sola participación de miembro por ronda gracias a la clave UNIQUE. No vincular una sesión rígidamente a IP o User-Agent: las redes móviles cambian. Registrar solo indicadores mínimos de uso anómalo si se necesitan.

Mantener sesiones de autenticación en D1 facilita revocación y evita agregar otro almacenamiento. La API de sesiones de Astro con el adaptador Cloudflare utiliza KV por defecto; en este diseño no se usa como almacén de autenticación. Revisar la configuración del adaptador para no aprovisionar recursos de sesión innecesarios. [Sesiones del adaptador Astro](https://docs.astro.build/en/guides/integrations-guide/cloudflare/#sessions).

La protección de cookies y la expiración deben verificarse desde servidor y navegador, no solo por configuración declarada. [Guía de sesiones de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

### 8.3 Administradores

**Recomendación: Cloudflare Access con proveedor de identidad existente y MFA**, limitado a una lista de organizadores. El CCFV debe confirmar que sus administradores tienen cuentas adecuadas y que el plan contratado soporta la política elegida.

- Proteger `/admin`, `/admin/*`, `/api/admin` y `/api/admin/*`; mantener las rondas públicas fuera de esa protección en producción.
- Validar en el Worker firma del JWT de Access, emisor, audiencia de la aplicación administrativa y tiempos de validez usando una biblioteca mantenida compatible con Workers. Obtener claves solo del emisor configurado y manejar su rotación.
- La cabecera de email o la mera presencia de `Cf-Access-Jwt-Assertion` no autorizan una acción. Consultar además `admin_principals` por emisor y sujeto verificados y exigir estado activo. [Token de aplicación de Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/).
- Usar MFA del proveedor o MFA independiente de Access según disponibilidad verificada. [MFA independiente de Access](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/independent-mfa/).
- Propuesta: sesión administrativa de ocho horas como máximo y nueva autenticación al vencer; acciones sensibles muestran claramente sus consecuencias. No crear un segundo sistema de contraseñas para organizadores.
- El administrador inicial se habilita mediante procedimiento operativo restringido, usando el sujeto de una identidad ya verificada en Access. No existe registro público, «primer visitante administrador» ni código maestro en el frontend.
- La gestión de la lista de administradores puede permanecer operativa en MVP; el panel gestiona miembros, no concede sus propios privilegios. Mantener al menos dos responsables recuperables y acceso seguro a Cloudflare/GitHub.
- Para revocar: desactivar el principal local y retirarlo de la política Access. El chequeo local evita esperar a que expire un JWT emitido anteriormente.
- Las escrituras administrativas críticas incluyen la condición de principal activo dentro de la operación de DB, para que una revocación concurrente no quede anulada por una comprobación anterior.
- Desactivar rutas `workers.dev` y previews públicos alternativos en producción o protegerlas de forma equivalente. Incluso una llamada que evite Access debe fallar en la validación del Worker.
- El bypass para pruebas solo puede existir en un entorno local de test inequívoco; no debe compilarse/habilitarse en producción. Las pruebas de JWT inválido son obligatorias.

Alternativas y recuperación administrativa se comparan en la sección 18. Un código de miembro nunca eleva privilegios administrativos.

## 9. Sistema de votación

### 9.1 Modalidad recomendada

| Modalidad | Ventajas | Coste o problema | Decisión MVP |
| --- | --- | --- | --- |
| Una elección por ronda | Explicación inmediata; una fila por participación; cambio simple | No expresa segundas preferencias | **Elegida** |
| Un voto por película, sin límite de películas | Permite expresar interés por varias | En realidad es aprobación múltiple; puede elegirse todo y cambia el significado del total | No implementar |
| Elegir hasta N películas | Preferencias más amplias | Reglas de cantidad, varias selecciones y actualización atómica de un conjunto | Evolución posible |
| Ranking de candidatas | Ordena preferencias | Más esfuerzo móvil, empates y algoritmo de cómputo por definir | Postergar |

En la evolución a múltiples selecciones se introducirían participaciones y selecciones hijas: UNIQUE por participante/ronda y por película/participación, con límite N validado atómicamente. El ranking necesitaría además posiciones únicas y reglas públicas de desempate. Versionar la modalidad por ronda y mantener el significado de los datos históricos; no reinterpretar votos anteriores.

### 9.2 Apertura y cierre

- Borrador: editable, sin votos, invisible al público.
- Publicar: exige 2–12 candidatas aprobadas, audiencia definida y fechas válidas; congela candidatas, audiencia y configuración de identidad pública.
- Si `status = published` y todavía no llegó `starts_at`, la ronda está programada.
- Está abierta únicamente si está publicada y **`starts_at <= hora_actual_DB < ends_at`**. El intervalo excluye el instante exacto de cierre.
- «Abrir ahora» publica un borrador con inicio actual o adelanta explícitamente el inicio de una ronda programada; comprueba que el cierre siga en el futuro y registra auditoría.
- Cerrar manualmente cambia el estado y registra `closed_at` en DB. La fecha límite también cierra efectivamente la ronda aunque no haya ejecutado ningún cron ni un administrador la haya visitado.
- Un mantenimiento o la operación de finalizar resultados puede normalizar a `closed` una ronda cuyo plazo venció. No se necesita un programador para hacer cumplir el límite de votación.
- No reabrir, ampliar fechas ni editar candidatas después del cierre. Si se necesita repetir una votación, crear otra ronda y explicar el motivo. Cancelar una ronda la conserva y deja de aceptar votos.

### 9.3 Escritura atómica del voto

Contrato del endpoint: candidata y ronda, token CSRF y token Turnstile cuando proceda. No aceptar `member_id`, `voter_key`, grupo, estado de moderación, conteos ni fecha del cliente como autoridad.

1. Resolver la identidad en servidor: sesión de miembro válida tiene precedencia. Si no hay sesión, solo se permite identidad anónima en ronda pública y con voto público habilitado para el entorno.
2. Validar datos con Zod, límites, CSRF y desafío si se requiere.
3. Ejecutar un **UPSERT condicional** basado en identidad + ronda. Tanto la inserción como la actualización deben quedar protegidas por estado y fechas de ronda, pertenencia de candidata y, para miembros, sesión y miembro aún habilitados.
4. La comprobación decisiva de tiempo sucede en SQL con el reloj de DB. Un SELECT anterior en JavaScript no autoriza una escritura posterior al cierre.
5. Confirmar la escritura y devolver la elección almacenada. Una ronda cerrada produce conflicto; no responder éxito por haber superado una comprobación preliminar.
6. Repetir la misma elección no suma nada. En dos cambios concurrentes válidos prevalece el último confirmado por DB; no el timestamp del navegador.

Si se pierde una respuesta, consultar la elección actual antes de ofrecer un reintento: la escritura puede haberse confirmado aunque el navegador no recibiera la confirmación. El formulario mantiene visible la diferencia entre selección pendiente y elección guardada.

Con varias escrituras inseparables, usar un batch atómico de D1 con todas las condiciones de dominio incluidas. El batch revierte ante error SQL; una sentencia que afecta cero filas **no** es por sí sola un error. Diseñar las sentencias posteriores para que no creen auditorías de éxito, snapshots o efectos parciales si no ocurrió la transición prevista. No asumir transacciones interactivas de un driver SQLite de escritorio. [Batch de D1](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch).

El cierre y el voto compiten por escrituras de DB: si se confirma primero el cierre, no se acepta el voto. Si se confirma primero el voto dentro del plazo, se incluye. Probar ambas secuencias y llamadas simultáneas reales al endpoint.

### 9.4 Identidad entre miembros y público

Las garantías estrictas son por **miembro/ronda** y por **identidad anónima/ronda**. No se puede garantizar una única persona entre ambos grupos sin identificar al público.

Recomendación para reducir duplicación detectable: si al votar como miembro existe un voto público previo de la cookie del mismo navegador en esa ronda, marcar ese voto público como excluido por `member_conversion` dentro del mismo batch del voto de miembro. Se conserva el registro para explicar los totales y deja de contarse como interés público. La exclusión no equivale a fraude.

Si ese voto ya estaba excluido por abuso, conservar su motivo y evidencia; no reclasificarlo silenciosamente. La conversión y las demás exclusiones se reflejan en la respuesta sobre la participación propia sin revelar señales técnicas antiabuso.

Un envío público posterior con esa identidad no reactiva una participación convertida. No permitir al cliente restaurar votos excluidos mediante el UPSERT. Esta regla solo cubre el voto previo detectable; otro navegador, cookies borradas o solicitudes anónimas independientes pueden permitir doble participación entre grupos. No enlazar historiales de dispositivos ni prometer una deduplicación personal global.

La conversión es una recomendación explícita a confirmar antes de MVP 2. No cambiar grupos al iniciar sesión: sucede cuando el miembro confirma su voto. Si ya tenía voto de miembro, se actualiza su elección normal, manteniendo una única fila.

### 9.5 Conteo, revisión y finalización

- Durante la ronda, obtener los conteos de cada tabla por separado y después combinarlos por candidata. No unir ambas tablas de votos sin agregarlas primero: produciría multiplicación de filas y conteos falsos.
- Incluir candidatas con cero votos y totales de participantes de cada grupo. Ejemplo de presentación: «Perfect Blue · Miembros CCFV: 17 · Público: 83».
- Una señal sospechosa marca una participación para revisión, pero no la excluye automáticamente. Los totales públicos en vivo son provisionales.
- El administrador puede excluir/restaurar por abuso con motivo antes de finalizar. La elección de la película no se edita administrativamente. Cambiar su voto tampoco limpia una marca o exclusión.
- Tras cerrar, finalizar resultados en un batch que compruebe el estado, guarde `round_movie_results` para todas las candidatas y establezca `results_finalized_at`. Revisar señales o aceptar expresamente su conservación antes de finalizar.
- La finalización se ejecuta una sola vez. No se admite moderación que altere el conteo después de finalizar; ante un error posterior, registrar una nota de incidencia y decidir una nueva ronda, sin reescribir silenciosamente el resultado publicado.
- Publicar requiere resultados finalizados. La vista pública usa el snapshot, mientras el panel distingue recibidos, contabilizados, excluidos por abuso y convertidos a miembro.
- Seleccionar una película es una decisión administrativa sobre esos resultados; no hay puntuación combinada ni ganador automático. Los empates se resuelven con criterio editorial documentado.

## 10. Prevención de abuso

### 10.1 Identificador anónimo

- Cookie `__Host-ccfv_visitor`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, sin `Domain`. Contiene 256 bits aleatorios emitidos por servidor, vencimiento y firma HMAC versionada. No contiene datos personales.
- Firmarla impide aceptar un identificador arbitrario elegido por el cliente; no impide que un bot solicite cookies nuevas. No otorgar al identificador ningún privilegio de miembro.
- Duración sugerida de 180 días, renovando la cookie sin cambiar el identificador mientras siga siendo válido. No regenerarlo en cada voto, visita, cierre de sesión o despliegue.
- Derivar `voter_key` mediante HMAC del identificador y `round_id`, con separación de propósito y una versión de clave fijada al publicar cada ronda. Así no se guarda en DB el identificador original ni un identificador público global reutilizado entre rondas.
- Mantener las claves necesarias para rondas activas y firmas vigentes. Rotarlas sin cambiar la derivación de una ronda abierta; una rotación mal diseñada permitiría otra participación para el mismo navegador.
- Establecer la cookie al cargar el formulario. Si un POST llega sin ella, pedir recargar/establecer cookie y reenviar; no crear una identidad nueva y contabilizar directamente. Probar el primer voto, dos pestañas y respuestas fuera de orden.
- Si se bloquean cookies, permitir leer, pero explicar por qué no se puede conservar una participación. No usar IP como reemplazo.
- Borrar cookies, usar incógnito, otro dispositivo o un navegador integrado diferente puede permitir otra participación. Esta limitación debe quedar visible en la explicación del voto público.

### 10.2 Límites iniciales, ajustables

Son hipótesis operativas para calibrar en staging y el piloto; no garantías globales ni decisiones irrevocables.

| Operación | Límite/señal inicial | Respuesta |
| --- | --- | --- |
| Intentos de código | 10 solicitudes/minuto por IP seudonimizada y 5 fallos/minuto por navegador | Espera y 429; desafíos ante reincidencia. No bloquear permanentemente un miembro por ataques ajenos. |
| Consulta IMDb/TMDB | 10/minuto por miembro | 429 y reutilización de caché |
| Crear propuesta | Hasta 5 al día por miembro, máximo 10 pendientes | Regla persistente consultada e impuesta en DB; explicación del límite |
| Enviar/cambiar voto | 10/minuto por identidad y ronda | 429 temporal, conservando el voto anterior |
| Voto público por red | Más de 60 solicitudes/minuto por señal de IP | Desafío o reducción temporal; no excluir todos los votos de esa IP |
| Emisión repetida de identidades o muchas primeras participaciones | Alerta por incremento y concentración temporal | Turnstile y revisión, combinando señales |

El binding de rate limiting de Workers sirve para límites rápidos por claves compuestas. Sus contadores son aproximados y locales a un centro de datos; no sustituyen UNIQUE ni las cuotas persistentes del negocio. Sus ventanas configurables deben respetar las admitidas por la API. No construir límites globales estrictos con variables en memoria del Worker. [Rate limiting de Workers](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

Separar namespaces y claves por entorno y operación. Comprobar disponibilidad del binding en la cuenta durante MVP 0. Las reglas WAF pueden reforzarlo si el plan las permite; no depender de una función pagada no verificada. Ante límites de volumen realmente estrictos se evaluaría Durable Objects, fuera del MVP.

### 10.3 IP y señales

Tomar la IP solo de metadatos/cabeceras confiables de Cloudflare en rutas desplegadas bajo su control; no confiar en un `X-Forwarded-For` arbitrario. Usarla transitoriamente para calcular HMAC con secreto de propósito antiabuso y período diario. No usar SHA-256 sin secreto: el espacio de IPs permite ataques de diccionario.

El HMAC diario sigue siendo un dato seudonimizado y sensible. Sirve para detectar ráfagas en un período limitado, no para identificar a una persona. No bloquear una universidad, familia o red móvil por compartir salida. No recolectar canvas, fuentes, hardware, localización precisa ni características para fingerprinting.

Señales básicas: muchas cookies nuevas desde una misma señal de red, alta velocidad, fallos reiterados de Turnstile, cambios excesivos y concentración súbita de primeras participaciones. La popularidad de una película o llegar desde Instagram no constituye evidencia de fraude por sí sola.

### 10.4 Turnstile

El servidor decide si el desafío es necesario; ocultar el widget o enviar `suspicious=false` no elude la política. Validar el token con Siteverify y comprobar `success`, hostname y acción esperados. Los tokens duran cinco minutos y son de un solo uso; renovar cuando venzan o ya se hayan utilizado. [Validación de Turnstile](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

Conservar la elección mientras se resuelve el desafío. Si Siteverify falla y el desafío era obligatorio, no guardar el cambio: ofrecer reintento sin perder el voto existente. Si no era necesario, las solicitudes normales siguen su flujo. No agregar una puerta de bypass pública por indisponibilidad. Usar claves de prueba solo en local/CI y claves separadas por entorno.

## 11. Integración con TMDB/IMDb

### 11.1 Resolución y confirmación

1. Aceptar enlaces HTTPS de los hosts IMDb explícitos `imdb.com`, `www.imdb.com` y `m.imdb.com`, con ruta de título. Se puede aceptar también un IMDb ID pegado directamente como mejora pequeña.
2. Analizar la URL con el parser estándar, no mediante una expresión regular sobre cualquier texto que contenga «imdb». Extraer `tt` seguido de dígitos de la ruta de título; imponer un límite razonable de longitud que no dependa de que todos los IDs tengan siete dígitos.
3. Rechazar enlaces de personas, hosts parecidos, credenciales incrustadas, puertos inesperados y URLs arbitrarias. Descartar parámetros de seguimiento y fragmentos. No descargar la URL enviada ni seguir redirecciones: no hay scraping ni SSRF hacia IMDb.
4. Buscar primero la película local por IMDb ID. Si no está o su ficha requiere actualización, consultar desde backend `GET /3/find/{imdb_id}?external_source=imdb_id` y procesar únicamente `movie_results`. La búsqueda externa también puede devolver otras clases de resultados, que este producto no acepta. [TMDB Find By ID](https://developer.themoviedb.org/reference/find-by-id).
5. Consultar los detalles de la película por TMDB ID y créditos, opcionalmente unidos con `append_to_response=credits`. Extraer dirección desde el equipo de créditos; admitir varios directores o ausencia de datos. [Detalles](https://developer.themoviedb.org/reference/movie-details) y [créditos de películas](https://developer.themoviedb.org/reference/movie-credits).
6. Preferir metadatos en español y usar fallback a título original/inglés si faltan textos. Mostrar «No disponible» para duración, sinopsis o fecha faltantes; nunca inventar director o año.
7. Guardar/reutilizar únicamente la ficha normalizada en `movies`. La vista previa puede crear esta caché sin crear una propuesta. Guardar la ficha completa antes de mostrarla, no filas incompletas en caso de fallo.
8. Devolver su ID interno y datos presentables. El miembro confirma el filme y envía ID interno y justificación. El servidor relee la ficha, valida elegibilidad y crea la propuesta pendiente; no confía en título, póster ni IDs externos reenviados por el cliente.

Si no hay película coincidente, explicar que no pudo resolverse. Si hay varias coincidencias de película, pedir escoger y confirmar entre los resultados verificados. El caso de una película ausente de TMDB se atiende fuera del flujo automático; un editor manual de catálogo no forma parte del MVP.

### 11.2 Resiliencia y uso de datos

- Token TMDB de solo lectura en secretos de Worker, enviado como autorización del backend. Nunca una variable `PUBLIC_*` ni una llamada del navegador con ese token.
- Timeout inicial de cinco segundos por solicitud y reintentos limitados para fallos transitorios; respetar 429 y `Retry-After` cuando exista. No reintentar indefinidamente 401, 403 o 404.
- Validar respuesta externa con Zod, tolerando campos opcionales. No propagar HTML ni errores internos del proveedor al usuario.
- Ficha cacheada con fecha de consulta y revisión sugerida a los siete días; una ficha ya disponible puede seguir usándose si TMDB está caído. La votación sobre candidatas existentes no depende de una llamada a TMDB.
- Construir URLs de póster solo con host y tamaños TMDB permitidos y `poster_path` validado. Usar imágenes responsivas, carga diferida y dimensiones reservadas; no agregar transformaciones de pago por defecto.
- Guardar solo lo necesario para la ficha; no copiar una base completa ni implementar sincronización masiva.
- Incluir logo aprobado y atribución en créditos, con el aviso: «This product uses the TMDB API but is not endorsed or certified by TMDB.» Confirmar las condiciones aplicables al uso concreto antes del lanzamiento; no asumir que los datos conceden derechos de proyección. [FAQ y atribución de TMDB](https://developer.themoviedb.org/docs/faq).

## 12. Panel administrativo

Cuatro áreas pequeñas: **Propuestas**, **Rondas**, **Miembros** y **Funciones**. Las señales de abuso y resultados se ven dentro de cada ronda; no crear un dashboard analítico separado.

| Área | Operaciones mínimas | Reglas |
| --- | --- | --- |
| Propuestas | Lista paginada, ficha, aprobar, rechazar y reabrir revisión | Mostrar autor internamente; rechazo/reapertura con motivo; transición condicional si otro administrador ya revisó |
| Rondas | Crear/editar borrador, agregar/quitar aprobadas, ordenar, vista previa, publicar, abrir ahora, cerrar, cancelar | Congelar candidatas desde publicación; confirmar visualmente fechas y audiencia |
| Resultados | Conteos separados, participación total, revisión pública, finalizar, publicar, seleccionar | Sin tabla ordinaria de quién votó qué; sin suma ponderada; no modificar conteos manualmente |
| Miembros | Crear, desactivar, reactivar con nuevo código, regenerar, revocar sesiones | Código visible una vez; acciones sensibles auditadas y con confirmación clara en interfaz |
| Funciones | Programar seleccionada, cambiar fecha, registrar proyección, cancelar función | Cambio de fecha actualiza la misma función; no cambia ronda ni votos; registrar fecha real |

Todos los endpoints administrativos se sitúan bajo `/api/admin/*`. Toda mutación usa POST/PATCH/DELETE según contrato y rechaza métodos no admitidos; los formularios HTML pueden concentrarse en POST. No ejecutar cambios de negocio con GET.

Contratos mínimos por implementar y probar:

| Grupo | Operación | Identidad exigida |
| --- | --- | --- |
| `/api/miembros/*` | Ingresar/salir; resolver IMDb; crear propuesta; revocar sesiones propias | Ingreso con código y preautenticación; resto con miembro activo, salvo salida idempotente |
| `/api/rondas/[id]/voto` | Crear o cambiar elección | Miembro válido o visitante válido según audiencia |
| `/api/admin/propuestas/*` | Aprobar/rechazar/reabrir | Access verificado + principal activo |
| `/api/admin/rondas/*` | Borrador, candidatas, publicación, cierre, resultados, selección | Access verificado + principal activo |
| `/api/admin/miembros/*` | Alta, desactivación, regeneración y revocación | Access verificado + principal activo |
| `/api/admin/funciones/*` | Programar/proyectar/cancelar | Access verificado + principal activo |

Definir errores de dominio estables: entrada inválida, no autenticado, sin permiso, entidad ausente, conflicto de estado/duplicado, límite alcanzado y proveedor no disponible. Mapearlos a HTTP 400/422, 401, 403, 404, 409, 429 y 503 según corresponda. HTML y JSON comparten semántica; no devolver 200 para ocultar una escritura fallida.

## 13. Seguridad

### 13.1 Amenazas y mitigaciones

| Amenaza | Mitigación y límite reconocido |
| --- | --- |
| Código de miembro robado | Código como credencial secreta; entrega restringida; revocar sesiones y regenerar; auditoría de la operación. Quien tiene el código puede suplantar al miembro hasta la revocación. |
| Fuerza bruta de códigos | Alta entropía, HMAC, formato acotado, límites por navegador/red y desafíos escalonados; errores genéricos. No permitir códigos elegidos por usuarios. |
| Sesión robada o fijada | HTTPS, cookies seguras, token nuevo al autenticar, hash en D1, plazos y revocación. No aceptar IDs de sesión proporcionados en URL. |
| Votos públicos automatizados | Cookie firmada, identidad por ronda, UNIQUE, límites, Turnstile y señales revisables. No garantiza una persona física por voto. |
| Spam de propuestas/TMDB | Solo miembros activos; límites diarios y de pendientes en DB; rate limiting de búsquedas; caché y tamaños máximos. |
| Modificación de votos ajenos | Identidad exclusiva de cookie/sesión; ignorar identificadores de autor enviados; UPSERT por identidad propia y ronda; sin endpoint de edición administrativa de elección. |
| Abuso de endpoints | Métodos, tipo de contenido y tamaños permitidos; Zod; permisos por operación; paginación y límites máximos; timeout de servicios externos. |
| CSRF, incluido login/logout | Origen validado contra configuración del entorno, token CSRF vinculado a identidad y operación, SameSite y ninguna mutación de negocio por GET. |
| XSS | Escape de Astro; textos de TMDB/propuestas como texto plano; no `set:html` para datos externos; URLs permitidas; CSP compatible con recursos requeridos. |
| SQL injection | Drizzle y parámetros enlazados; nombres de columnas/ordenamientos de allowlist; nunca interpolar texto de usuario en SQL. |
| Exposición de TMDB u otros secretos | Secretos solo server-side; separar variables públicas; redactar logs y errores; revisar bundle, source maps publicados y artefactos CI. |
| Escalada a administrador | Access con MFA, validación criptográfica y allowlist local; separación de miembro; rutas alternativas protegidas; revocación y auditoría. |
| Duplicación de propuestas o votos | UNIQUE en DB y manejo de conflictos; FK compuesta; pruebas concurrentes. Deshabilitar un botón no es la garantía. |
| Manipulación de resultados desde cliente | Conteos calculados en servidor, snapshots finales, no aceptar puntuaciones/estados del cliente, evitar multiplicación de filas en consultas. |
| SSRF mediante enlace IMDb/póster | Extraer el ID sin descargar la URL; hosts fijos para consultas e imágenes; no proxy abierto. |
| Error o abuso de un organizador | Motivos, trazabilidad, estados congelados y snapshots; acceso mínimo a infraestructura. Un administrador de D1 sigue teniendo capacidad técnica para alterar datos: auditoría de aplicación no es inmutabilidad criptográfica. |

### 13.2 CSRF y cabeceras

Usar tokens de formulario firmados, vinculados al identificador de sesión/visitante y a la operación, con caducidad breve —propuesta: dos horas—. Para ingreso, emitir identidad de preautenticación y token; para administración, vincularlo a la identidad Access verificada y su sesión. No basta con un double-submit sin firma ni vinculación.

Exigir origen permitido en mutaciones de navegador. Si un navegador legítimo no envía `Origin`, comprobar `Referer` de mismo origen y token válido; rechazar origen `null` o ausencia de ambas señales. Fetch Metadata puede reforzar este control. No habilitar CORS con credenciales para orígenes arbitrarios. [Prevención CSRF de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

Configurar CSP con orígenes mínimos para imágenes TMDB y Turnstile, `frame-ancestors` restrictivo, `form-action` propio, `X-Content-Type-Options: nosniff`, política de referrer restrictiva y HTTPS/HSTS en producción. Verificar que la política no rompa Turnstile ni las páginas Astro. No insertar una lista amplia de permisos sin necesidad.

### 13.3 Límites y respuesta a incidentes

Propuesta inicial: cuerpo de formulario hasta 16 KiB, justificación 500 caracteres, descripción de ronda 2.000, nombres/títulos internos 150 y listados de 50 filas por página como máximo. Limitar también lectura del cuerpo, no solo confiar en `Content-Length`. Ajustar los campos de ficha TMDB con límites propios.

Incidente de credenciales: revocar, regenerar, revisar eventos y avisar al miembro por el canal operativo del CCFV. No borrar automáticamente sus votos anteriores. Si una ronda de miembros queda comprometida y no se puede determinar una corrección fiable, cerrarla/cancelarla y repetirla con otra identidad de ronda, dejando constancia.

Incidente público: activar desafíos o cerrar la ronda con una operación administrativa; revisar evidencia antes de excluir. Secretos comprometidos: rotar por propósito y entorno, evaluando el impacto sobre códigos, cookies y claves de rondas abiertas. Fallo de D1: rechazar temporalmente escrituras y conservar la selección en pantalla; nunca confirmar un voto guardado solo en memoria.

## 14. Testing

Las pruebas forman parte de cada fase, no de una fase final. Priorizar invariantes de seguridad, persistencia y flujos completos. No buscar un porcentaje artificial de cobertura ni snapshots extensos de HTML que no detecten errores de negocio.

### 14.1 Herramientas y niveles

| Nivel | Herramienta propuesta | Qué demuestra |
| --- | --- | --- |
| Unit tests | Vitest | Parser IMDb; normalización de códigos; esquemas Zod; derivación de identidad; estados efectivos y reglas puras |
| Integración con runtime | Integración Vitest de Cloudflare compatible con versiones fijadas | Web Crypto, cookies, bindings, repositorios y comportamiento real del runtime |
| DB | D1 local con las migraciones reales | UNIQUE, FKs, CHECK, UPSERT, batch, conteo y carreras |
| HTTP/endpoints | Worker compilado ejecutado localmente | Middleware, autorización, CSRF, contratos y métodos completos, no solo funciones aisladas |
| E2E | Playwright | Flujos de usuario, persistencia entre recargas, navegación y accesibilidad básica |
| Staging | Smoke tests y revisión manual dirigida | Configuración real de Access, secrets, D1, HTTPS, Turnstile y navegación móvil |

Cloudflare ofrece pruebas dentro del runtime y herramientas para probar Workers compilados. Elegir la integración vigente al fijar dependencias; no copiar configuración de un paquete de pruebas antiguo sin verificar compatibilidad. [Testing de Workers](https://developers.cloudflare.com/workers/testing/) e [integración Vitest](https://developers.cloudflare.com/workers/testing/vitest-integration/).

### 14.2 Casos obligatorios

**Base de datos y concurrencia**

- Aplicar todas las migraciones sobre D1 vacía y sobre el esquema de la versión anterior; comprobar integridad referencial.
- Insertar directamente un segundo voto con igual miembro/ronda falla por UNIQUE, aunque cambie la película. Lo mismo para visitante/ronda.
- Película existente pero ajena a la ronda falla por FK compuesta. Repetir con round_id inexistente, nulos y estados inválidos.
- Diez envíos concurrentes del mismo participante dejan una fila; varias identidades dejan tantas filas como identidades válidas. Controlar el limiter en esta prueba para que no esconda fallos de DB.
- Cambios conservan el ID y total de participaciones; reintentos idénticos no suman votos.
- Carrera voto/cierre en ambos órdenes; carrera regeneración/login; carrera desactivación/voto; dos revisores sobre la misma propuesta.
- Dos propuestas simultáneas del mismo IMDb/TMDB generan una película canónica y una propuesta. Cuotas de propuestas también resisten concurrencia.
- Publicación congela candidatas incluso si otro administrador intenta quitarlas simultáneamente.
- Conteos con varias filas de miembros y público evitan multiplicación por JOIN; candidatas con cero votos aparecen.
- Finalizar dos veces no duplica snapshots; un fallo intermedio revierte el conjunto y no deja marca de finalización parcial.
- Excluir/restaurar públicamente y convertir un voto previo a miembro conserva la coherencia entre totales. El endpoint público no restaura exclusiones.
- Desactivar miembro no elimina su voto anterior; purgar votos tras la retención no cambia snapshots.

**Autenticación, permisos y seguridad HTTP**

- Código válido, inválido, malformado, antiguo, regenerado y desactivado; mensajes genéricos y ausencia de códigos en logs.
- Hash almacenado distinto del código; formato y entropía del generador verificados; cookie de sesión nueva al ingresar.
- Atributos de cookies, vencimiento absoluto e inactividad; salida actual/todas las sesiones y dos dispositivos del mismo miembro.
- Público no propone, miembro no administra, admin sin identidad de miembro no fabrica votos de miembro.
- Sesión vencida no convierte silenciosamente un envío en público; audiencia interna y flag público se validan en servidor.
- JWT Access ausente, firma falsa, emisor/audiencia incorrectos, expirado y principal desactivado. Cabecera de email falsificada no sirve.
- Acceso directo a endpoints administrativos, rutas alternativas y cualquier Action futura; no depender de navegar primero por la página protegida.
- CSRF ausente, incorrecto, expirado, de otra sesión/acción u origen; JSON y formularios; métodos no admitidos y cuerpos excesivos.
- XSS en justificación, títulos y respuestas TMDB; SQL injection; enlace IMDb con host engañoso o destino interno.
- Intento de enviar identidad ajena, estado de moderación, puntos, fechas o rol; el servidor los rechaza/ignora según contrato estricto.
- HTML, JSON, cachés y bundles no filtran elección de otros, conteos aún ocultos ni secretos.

**Abuso y fallos externos**

- Cookie pública alterada, vencida o ausente; primera participación y dos pestañas; firma rotada conservando identidad.
- Borrado de cookies genera otra identidad como limitación conocida, sin presentarlo como fallo de una promesa de identidad personal.
- Muchos navegadores detrás de una IP no se descartan automáticamente; ráfaga puede exigir desafío.
- Rate limiting devuelve 429 y permite recuperar el flujo; cuotas diarias usan DB, no un contador local.
- Turnstile inválido, omitido cuando es necesario, replay, expiración, hostname/acción incorrectos y timeout; el voto anterior se conserva.
- TMDB sin coincidencias, respuesta de TV, varios resultados, datos incompletos, 429, 401, respuesta inválida y caída.
- D1 falla después de validar: no se muestra éxito. Reintento posterior mantiene una sola participación.

### 14.3 E2E críticos

| Flujo | Secuencia | Aserciones finales |
| --- | --- | --- |
| Público | Abrir enlace → ver ronda → elegir A → votar → recargar → cambiar a B | Un voto público para B, ninguno de miembro, total público = 1; elección persiste |
| Miembro | Ingresar código → volver con sesión → resolver IMDb → confirmar propuesta → votar | Una propuesta pendiente; no aparece automáticamente en ronda; un voto de miembro |
| Administrador | Revisar propuesta → crear ronda → agregar candidatas → abrir → cerrar → consultar/finalizar resultados | Solo aprobadas incluidas; tras cierre ningún cambio; conteos separados y snapshot coherente |
| Cierre con formulario antiguo | Abrir formulario → cerrar ronda en otro contexto → enviar | Conflicto visible; ninguna modificación persistida |
| Sesión revocada | Ingresar → administrador regenera código → intentar proponer/votar | Operación rechazada; nuevo código funciona y anterior no |
| Desafío público | Intento sospechoso → desafío → validación → votar/cambiar | Se conserva la selección; solo se guarda con validación correcta |
| Selección y función | Finalizar → seleccionar → programar → marcar proyectada | Relación película/ronda/fecha preservada, votos intactos |

Usar fixtures ficticias, reloj controlado para reglas puras y fechas relativas a DB en integración. No depender de esperas de minutos para probar cierres. Aislar DB y cookies entre pruebas; compartirlas intencionalmente en pruebas de concurrencia.

TMDB y Siteverify se simulan en tests deterministas. Además, una comprobación en staging valida conectividad real con credenciales de ese entorno. Access se prueba criptográficamente con claves de test locales y con una cuenta autorizada en staging; no desactivar seguridad de producción para que Playwright pase.

Probar Chromium móvil en CI y los flujos críticos en WebKit; realizar una revisión manual breve en Instagram integrado, Android/iOS disponibles, teclado y lector de pantalla. Verificar que el formulario básico funciona sin JavaScript cuando no necesita desafío.

## 15. Despliegue, infraestructura y observabilidad

### 15.1 Entornos

| Entorno | Worker/ejecución | D1 | Credenciales y acceso |
| --- | --- | --- | --- |
| Local | Astro con adaptador Cloudflare y runtime local | DB local, fixtures ficticias | Secretos locales ignorados por Git; claves Turnstile de prueba |
| CI | Build y Worker local de pruebas | DB efímera y migrada | Mocks; ningún secreto de producción en PRs |
| Staging | Worker independiente y hostname distinto | D1 exclusiva de staging | Access, políticas y claves de pruebas propias; participantes de prueba |
| Producción | Worker y dominio CCFV | D1 exclusiva de producción | Secrets propios; administración protegida; público según fase |

Wrangler permite trabajar con recursos simulados localmente. No conectar accidentalmente desarrollo a una D1 remota: declarar explícitamente el entorno y comprobar el nombre de base antes de operaciones remotas. [Desarrollo local de Workers](https://developers.cloudflare.com/workers/local-development/) y [D1 local](https://developers.cloudflare.com/d1/best-practices/local-development/).

MVP 1 se usa internamente: `PUBLIC_VOTING_ENABLED=false` y rondas de audiencia `members`. Staging permanece restringido a pruebas. Si se protege todo staging con Access, distinguir esa barrera de acceso del permiso administrativo; entrar a staging no convierte a alguien en administrador.

### 15.2 Configuración

| Tipo | Valores propuestos | Tratamiento |
| --- | --- | --- |
| Bindings | `DB` y limitadores por operación | Configuración y IDs separados por entorno |
| Variables no secretas | Entorno, origen permitido, zona de visualización, flag público, emisor y audiencia Access, límites | Validadas al iniciar/atender; origen tomado de configuración confiable |
| Pública intencional | Site key de Turnstile | Es publicable; restringir hostnames en Cloudflare |
| Secrets de runtime | Token TMDB, secret Turnstile, claves de códigos, firma de cookie anónima, derivación por ronda, CSRF y antiabuso | Secretos separados por propósito, versionados donde corresponda; nunca al bundle |
| Secretos CI de despliegue | Token Cloudflare de mínimo alcance y account ID/configuración necesaria | GitHub Environments separados; acceso solo en jobs confiables |

Fijar `compatibility_date`, versiones de Node y gestor de paquetes compatibles y lockfile. Elegir una combinación estable de Astro, adaptador, Tailwind, Drizzle y herramientas de pruebas. La documentación puede mostrar versiones RC o ejemplos antiguos; no adoptarlos por defecto.

Validar variables obligatorias y fallar de forma explícita si falta un secreto. Nunca utilizar un secreto de desarrollo como fallback productivo. La cuenta Cloudflare, dominio y repo GitHub deben pertenecer al CCFV o a responsables con un procedimiento de transferencia claro.

### 15.3 Migraciones

1. Drizzle schema como descripción de tablas; Drizzle Kit genera SQL para revisión. Documentar SQL manual necesario para índices parciales o restricciones no expresadas por el generador.
2. Un único ejecutor de migraciones: Wrangler D1. No alternar su historial con otro migrador que aplique dos veces los mismos archivos.
3. Configurar una carpeta/patrón de migraciones que coincida con la salida de la versión de Drizzle fijada. Versionar SQL y metadatos; no editar migraciones ya aplicadas.
4. Aplicar primero a D1 local vacía y una fixture de actualización; luego a staging; finalmente a producción con DB y entorno explícitos.
5. Usar cambios compatibles hacia atrás: agregar estructura, desplegar código que la usa y eliminar lo antiguo en una entrega posterior si hace falta.
6. Comprobar integridad referencial después de cambios. Diferir temporalmente claves en una migración no equivale a desactivarlas permanentemente.
7. No usar `push` de esquema contra producción ni ejecutar migraciones automáticamente desde una petición web.

Wrangler registra las migraciones aplicadas y permite configurar su ubicación. Los cambios de esquema deben conservar ese historial. [Migraciones D1](https://developers.cloudflare.com/d1/reference/migrations/).

### 15.4 GitHub y despliegue

Recomendación: **GitHub Actions como único pipeline de despliegue**, por el control explícito de pruebas y migraciones. Workers Builds es una alternativa, pero no activar ambos sobre la misma rama y entorno. [CI/CD de Workers](https://developers.cloudflare.com/workers/ci-cd/) y [GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/).

Flujo propuesto:

1. Crear repo y rama principal protegida en MVP 0, con PRs pequeños por fase. Esta planificación no inicializa ni publica el repo.
2. PR: instalación reproducible, formato/lint, chequeo Astro/TypeScript, unit tests, migraciones/DB, integración, build y E2E críticos. No entregar secretos a forks ni ejecutar código de un PR no confiable con credenciales de despliegue.
3. Merge a `main`: pipeline serializado por entorno, migración de staging, build/despliegue de ese commit y smoke test.
4. Promoción de un commit ya verificado a producción mediante release o ejecución manual del workflow. Usar GitHub Environment protegido; el CCFV define quién puede promover.
5. Antes de migrar producción, identificar punto de restauración y comprobar compatibilidad. Aplicar migraciones, desplegar el mismo commit con configuración de producción y ejecutar smoke test sin modificar votos reales.
6. Registrar SHA, fecha, versiones y estado de despliegue sin secretos. Si falla staging o una migración, no promover.
7. Serializar promociones: no cancelar una migración en curso para lanzar otro despliegue. Fijar acciones externas a revisiones verificadas y permisos mínimos.

No hace falta un backend hospedado en GitHub: GitHub guarda código y ejecuta CI; Cloudflare ejecuta la aplicación. No desplegar una API separada ni usar GitHub Pages para las rutas de servidor.

### 15.5 Recuperación y mantenimiento

- Ensayar restauración en staging antes del lanzamiento público. D1 dispone de Time Travel; verificar la ventana aplicable a la cuenta y conservar un procedimiento operativo probado. [Time Travel y backups](https://developers.cloudflare.com/d1/reference/time-travel/).
- Un rollback de Worker no revierte la DB. Preferir migraciones compatibles y correcciones hacia adelante. Restaurar una DB de producción requiere detener escrituras y evaluar qué votos posteriores al punto de restauración se perderían.
- Tras restaurar, invalidar sesiones y revisar credenciales/administradores revocados después del punto restaurado; una copia antigua puede reactivar datos que ya habían sido anulados.
- Para retención, prever una tarea diaria desde un workflow programado de GitHub que ejecute una operación de mantenimiento versionada con credenciales restringidas. No crear un endpoint de limpieza público. No es necesaria para el cierre de las rondas.
- El mantenimiento elimina datos vencidos por lotes acotados y registra cantidad/resultado; borrar primero señales que referencian votos antes de purgar estos. Nunca purgar participaciones de rondas activas.
- Vigilar consumo de Workers y D1, lecturas/escrituras, errores y latencia. Verificar límites y coste de la cuenta en MVP 0 y antes de MVP 2; no prometer coste cero ni escala ilimitada.

### 15.6 Observabilidad mínima

Logs estructurados con `request_id`, entorno, ruta normalizada, tipo de evento, resultado, duración y códigos de error seguros. No registrar parámetros sensibles, cuerpos, cookies, autorización, código ingresado ni respuesta completa de proveedores. Revisar también la captura automática de la plataforma para evitar que contradiga esta política.

| Evento/medición | Utilidad | Datos mínimos |
| --- | --- | --- |
| Fallos 5xx, D1 y dependencias | Detectar indisponibilidad | Ruta, request ID, clase de error, duración |
| Autenticación y revocación | Detectar fallos/operar accesos | Éxito/fallo categorizado, ID interno solo si procede; sin código ni token |
| Voto creado/cambiado/rechazado | Ver salud del flujo | Ronda, grupo, resultado y duración; métricas agregadas, sin historial nominal de elecciones |
| Límites y desafío | Calibrar antiabuso | Regla, acción, ronda opcional; HMAC temporal solo cuando sea necesario |
| Propuesta revisada y transiciones de ronda | Trazabilidad editorial | Actor administrativo, entidad, transición, motivo y fecha |
| Código regenerado/miembro desactivado | Auditoría de acciones sensibles | Administrador, miembro, acción y fecha, sin hashes ni código |
| Exclusión/restauración/finalización | Explicar resultados | Actor, voto interno/ronda, motivo y estado; snapshot agregado |
| Despliegue/migración/mantenimiento | Diagnóstico operativo | Commit, versión, resultado y cantidades |

Métricas iniciales: errores por ruta, latencia p95, votos aceptados/cambiados, fallos de ingreso, proporción de desafíos, errores TMDB y uso de D1. No registrar cada visita individual con un identificador persistente. La auditoría administrativa se guarda en D1 junto con la mutación crítica; los logs de diagnóstico pueden muestrearse.

Política inicial propuesta, pendiente de acuerdo en MVP 2:

- Logs técnicos: 14 días, según configuración disponible del servicio.
- Señales/HMAC de IP: hasta 7 días; ventanas de enlace diarias, sin conservar IP original.
- Sesiones: rechazar al vencer aunque siga la fila; purgar siete días después de vencimiento/revocación.
- Votos individuales y detalle de revisión: 90 días después de finalizar resultados, o del cierre/cancelación si la ronda se abandona; no purgar una ronda cerrada pendiente de finalización sin resolverla antes.
- Auditoría administrativa: 12 meses, con identificadores mínimos y motivos sin datos personales innecesarios.
- Películas, funciones y resultados agregados finales: conservar para historia del club.

Asignar un responsable del CCFV para revisar errores y alertas del proveedor. Alertar por fallos sostenidos, pérdida de escrituras, despliegue fallido o salto anómalo de participaciones; no crear infraestructura adicional de monitorización en el MVP. Revisar los plazos de backups y logs del proveedor, porque eliminar una fila no implica borrarla de todas las copias inmediatamente.

## 16. Roadmap MVP 0 / MVP 1 / MVP 2

### 16.1 MVP 0 — Base técnica verificable

**Objetivo:** demostrar que el stack funciona completo en local y staging, con persistencia, migraciones, seguridad HTTP básica y pruebas, antes de construir pantallas de negocio.

**Funcionalidades:** página mínima renderizada en Worker, comprobación controlada de D1, configuración por entorno y pipeline inicial. Sin votación utilizable ni panel completo.

| Orden | Tareas | Dependencias | Criterios de aceptación |
| --- | --- | --- | --- |
| 0.1 | Inicializar Git y Astro/TS; fijar versiones compatibles, Tailwind y adaptador; configurar lint/typecheck y lockfile | Este plan; elección de gestor de paquetes | Build reproducible; no framework de componentes adicional |
| 0.2 | Definir bindings y tipos, D1 local/staging, Drizzle y proceso de migración | 0.1; cuenta Cloudflare para staging | Migración local y staging; escritura/lectura persiste tras nueva petición |
| 0.3 | Crear esquema del núcleo y verificar UNIQUE, FKs compuestas y UPSERT condicional con fixtures | 0.2 | Prueba de voto repetido y cierre no permite inconsistencias; sin depender de UI |
| 0.4 | Preparar wrappers de validación, respuestas, secretos, origen/CSRF, logs redactados y caché | 0.1–0.2 | Un endpoint de prueba rechaza entrada/origen inválido; no filtra secretos |
| 0.5 | Configurar Vitest/runtime, pruebas DB y Playwright mínimo | 0.2–0.4 | CI instala, migra, prueba y compila de cero |
| 0.6 | Configurar GitHub → staging; verificar viabilidad de Access, MFA y rate limiting; ensayar restauración | Repo remoto, credenciales del CCFV y 0.5 | Staging aislado; pipeline serializado; decisiones de infraestructura documentadas |

**Salida de fase:** combinación del stack y primitivas de integridad comprobadas. Si faltan credenciales externas, completar local/CI y documentar exactamente lo pendiente; no declarar terminado staging sin probarlo. El acceso administrativo debe resolverse antes de exponer funciones internas reales.

### 16.2 MVP 1 — Primera versión interna

**Objetivo:** que miembros y organizadores completen una ronda real del CCFV con revisión previa y resultados fiables.

**Funcionalidades:** administración independiente, miembros/códigos/sesiones, propuestas TMDB, rondas internas, voto de miembro, resultados, selección y registro mínimo de función. Voto público deshabilitado en servidor.

| Orden | Tareas | Dependencias | Criterios de aceptación |
| --- | --- | --- | --- |
| 1.1 | Access + allowlist local, bootstrap operativo y auditoría; crear/regenerar/desactivar miembros | MVP 0 y decisión de autenticación administrativa | Un miembro nunca administra; credenciales regeneradas/revocadas dejan de funcionar |
| 1.2 | Ingreso, sesión persistente, salida y revocación propia | 1.1; política de sesiones | Dos dispositivos conservan sesiones; comparten un único voto de miembro/ronda |
| 1.3 | Parser IMDb, cliente TMDB, vista previa, confirmación y propuestas pendientes | 1.2; token TMDB | Flujo sin scraping; metadata no falsificable desde cliente; duplicados controlados |
| 1.4 | Revisar propuestas y crear rondas con candidatas aprobadas y fechas | 1.1 y 1.3 | Una propuesta no se incluye sola; pendientes/rechazadas no se agregan |
| 1.5 | Publicar/abrir/cerrar ronda interna y votar/cambiar con UPSERT | 1.2 y 1.4 | Repeticiones/concurrencia dejan una fila; límite temporal se impone en DB |
| 1.6 | Resultados de miembro, finalización, selección y programación/proyección | 1.5 | Snapshots coherentes, selección explícita y función vinculada; público sin acceso interno |
| 1.7 | E2E de miembros/admin, seguridad y piloto con una ronda ficticia; luego ronda interna real | 1.1–1.6 | CCFV completa el flujo y verifica conteos; no hay defectos de permisos/duplicación abiertos |

**Salida de fase:** una versión operable internamente con instrucciones breves para entregar códigos, revisar propuestas, cerrar rondas y responder a una pérdida de acceso. No requiere archivo público, imágenes subidas ni herramientas analíticas avanzadas.

### 16.3 MVP 2 — Primera versión pública

**Objetivo:** permitir acceso desde enlaces sociales y recoger interés del público con baja fricción y controles razonables.

**Funcionalidades:** rondas públicas, identidad anónima, voto/cambio, límites, Turnstile adaptativo, revisión de abuso, resultados separados publicados y operación observable.

| Orden | Tareas | Dependencias | Criterios de aceptación |
| --- | --- | --- | --- |
| 2.1 | Confirmar políticas públicas; habilitar audiencia pública y cookie firmada con claves versionadas | Piloto MVP 1; decisiones 18 sobre privacidad y voto público | Misma cookie conserva identidad/ronda; claves no cambian participaciones al desplegar |
| 2.2 | Voto público atómico, cambio y tratamiento de voto previo al ingresar como miembro | 2.1 y política entre grupos | E2E público pasa; tablas separadas; no se restaura una exclusión por enviar otro voto |
| 2.3 | Límites, señales acotadas, Turnstile y pantalla de revisión dentro de ronda | 2.2; binding y claves del entorno | Bots básicos encuentran límites/desafíos; red compartida no se descarta automáticamente |
| 2.4 | Conteos públicos provisionales/finales, revisión y publicación de snapshots | 2.3 | Cada exclusión tiene motivo; publicados coinciden con snapshots y separan grupos |
| 2.5 | UX móvil, accesibilidad, Open Graph, créditos TMDB y aviso de privacidad/cookies | 2.2–2.4 | Entrar → votar → cambiar sin login; Instagram y pantallas pequeñas revisados |
| 2.6 | Pruebas de abuso/concurrencia, carga acotada, retención, observabilidad y recuperación | 2.3–2.5 | Sin errores de integridad; alertas y mantenimiento verificables; restauración ensayada |
| 2.7 | Promover versión verificada y habilitar voto público; observar una primera ronda | 2.1–2.6 y responsables disponibles | Smoke de producción correcto; flags, orígenes y secretos productivos comprobados |

**Salida de fase:** primera ronda pública utilizable. Propuesta de ensayo de carga: 100 navegadores ficticios sobre una ronda con 12 candidatas, más 10 cambios concurrentes de una identidad en una prueba de integridad separada. La tasa y distribución se calibran al volumen esperado; verificar que los rechazos antiabuso sean esperados y que no haya votos duplicados ni 5xx inesperados.

## 17. Criterios de aceptación globales

Una fase está terminada cuando sus pruebas pasan, su flujo se verifica en el entorno correspondiente y sus restricciones se cumplen también mediante llamadas directas al servidor.

- [ ] Solo se utiliza un proyecto Astro full-stack con el stack acordado.
- [ ] El público abre una ronda pública y vota sin cuenta, email ni contraseña.
- [ ] La cookie persistente permite consultar/cambiar el voto en el mismo navegador; sus límites se explican honestamente.
- [ ] Un miembro entra mediante código generado y permanece autenticado según política; DB no contiene el código original.
- [ ] Desactivación y regeneración invalidan credenciales/sesiones; no eliminan resultados históricos.
- [ ] IMDb se usa como identificador, sin scraping; la ficha se confirma antes de enviar una propuesta.
- [ ] Ninguna propuesta entra automáticamente a votación; solo administradores incorporan aprobadas.
- [ ] Una identidad participante tiene como máximo una fila de voto por ronda, incluso con envíos simultáneos.
- [ ] Cambiar A por B conserva el total y la identidad del voto, mientras la ronda esté abierta.
- [ ] Ronda cerrada, cancelada, futura o en borrador no acepta votos ni cambios; reloj y permisos son del servidor/DB.
- [ ] Una película fuera de la ronda no puede recibir un voto para esa ronda.
- [ ] Votos de miembros y público se almacenan y cuentan por separado; no existe fórmula ponderada.
- [ ] Miembro, público y administrador no obtienen permisos enviando campos/cabeceras falsificados.
- [ ] Resultados ocultos no se filtran en payloads; resultados publicados salen de snapshots finalizados.
- [ ] Revisión de abuso no modifica preferencias ni borra filas sin explicación; la IP no funciona como identidad.
- [ ] Selección, fecha programada y proyección quedan registradas sin convertir el catálogo en un único enum global.
- [ ] Unit tests, DB/integración, contratos HTTP y los tres E2E críticos pasan en CI.
- [ ] Staging y producción tienen datos, secretos y políticas independientes; las migraciones son reproducibles.
- [ ] Logs y mantenimiento respetan la minimización definida; existe procedimiento probado de recuperación.
- [ ] La interfaz móvil comunica guardado, cambio, cierre y errores de forma accesible.
- [ ] El CCFV conoce las decisiones abiertas aplicables y acepta sus valores antes de la fase que las necesita.

## 18. Decisiones abiertas

Estas decisiones no están aprobadas por el usuario solo por aparecer recomendadas. El agente puede construir la base técnica y pruebas independientes; antes de implementar comportamiento dependiente, debe confirmar las decisiones indicadas o recibir autorización para usar los valores recomendados.

| Decisión | Alternativas y ventajas/desventajas | Recomendación inicial | Resolver antes de |
| --- | --- | --- | --- |
| Modalidad | Una elección es clara; hasta N recoge más preferencias; ranking aporta orden con más fricción y reglas | Una elección por ronda, cambio permitido; evolucionar solo con necesidad observada | MVP 1, antes de fijar UX de votación |
| Visibilidad de resultados | En vivo aumenta transparencia pero influye en siguientes votos; al cerrar/finalizar reduce arrastre; ocultarlos siempre impide transparencia pública | Admin en vivo; resto después de finalizar y publicar | MVP 1 |
| Autoría de propuestas | Pública puede dar contexto y generar presión; anónima hacia otros reduce sesgo; anonimato total impide moderación y cuotas | Identificada para autor/admin, oculta para otros | MVP 1 |
| Códigos perdidos o robados | Regeneración presencial/canal conocido es simple; autoservicio exige otro factor y recuperación | Verificación humana del CCFV, regeneración y revocación de todas las sesiones; acordar canal de entrega | MVP 1 |
| Autenticación administrativa | Access + IdP/MFA reduce implementación pero depende de cuentas/plan; passkeys propias evitan email pero requieren alta y recuperación; códigos administrativos largos + segundo factor exigen mantener más seguridad propia | Access + MFA y allowlist local, separado del código de miembro; no usar contraseña/código compartido | MVP 0 para viabilidad; antes de MVP 1 real |
| Duración de sesiones | Largas reducen fricción pero prolongan exposición; cortas exigen códigos frecuentes | Miembros 30 días absolutos/14 inactivos; admins 8 horas; visitante 180 días con renovación estable | MVP 1; visitante antes de MVP 2 |
| Propuesta duplicada | Bloquear simplifica; sumar apoyos conserva interés pero agrega otra interacción y tabla | Mostrar la existente sin sumar apoyo; reabrir rechazos solo por administración | MVP 1 |
| Votos públicos sospechosos | Excluir automáticamente es rápido pero castiga falsos positivos; contar todo ignora abuso; revisión demanda poco trabajo a esta escala | Marcar, desafiar y revisar; contabilizar mientras no haya exclusión motivada; finalizar tras resolver/aceptar señales | MVP 2 |
| Paso de público a miembro | Conservar ambos evita cruces de datos pero duplica señal detectable; convertir el voto previo agrega una regla y mejora coherencia | Excluir como conversión el voto público previo de esa cookie cuando confirme el voto de miembro; sin promesa entre dispositivos | MVP 2 |
| Señales y retención | Sin señal de red hay menos capacidad de diagnóstico; IP completa aporta trazabilidad innecesaria; HMAC temporal limita exposición pero sigue siendo seudónimo | HMAC diario con secreto, señal hasta 7 días; votos individuales 90 días tras finalización; agregados históricos | MVP 2 y redacción del aviso público |
| Empates y decisión final | Ganador automático simplifica, pero no considera programación; comité conserva criterio y requiere explicarlo | Una selección administrativa por ronda, motivo en empate/desviación; sin ponderación | MVP 1 |
| Fechas y reapertura | Permitir editar una ronda abierta facilita operación pero cambia reglas en marcha; congelar obliga a crear otra si hay error | Publicación congela configuración; permitir apertura/cierre anticipados explícitos; no reabrir ni extender después de publicar | MVP 1 |
| Audiencia y cantidad de rondas | Solo una abierta simplifica portada; varias permiten ciclos simultáneos, con más navegación | Modelo admite varias; enlace directo por ronda y listado simple, sin imponer unicidad global de ronda abierta | MVP 1 |
| Elegibilidad de miembros | Padrón congelado al abrir es más formal y necesita una tabla adicional; miembros activos al votar es simple pero permite incorporaciones posteriores | Miembro activo al emitir/cambiar; conservar votos previos al desactivar. Confirmar que no es una elección formal | MVP 1 |
| Tamaño y volumen | Más candidatas/participaciones exigen ajustes de UX y límites; restricciones bajas pueden ser incómodas | 2–12 candidatas; límites del apartado 10 como hipótesis, calibrados con tamaño real del CCFV y tráfico esperado | Piloto MVP 1 y lanzamiento MVP 2 |
| Dominio, propiedad y operación | Cuenta personal facilita arranque pero complica transferencia; cuenta/responsables del club mejoran continuidad | Recursos y repo bajo control acordado del CCFV; dos responsables, promoción productiva protegida | MVP 0/staging |
| Publicación del archivo | Registro básico es barato; contenido editorial y medios requieren permisos, almacenamiento y mantenimiento | Solo funciones y snapshots en MVP; archivo público y medios después | Después de MVP 2 |

No se necesitan respuestas a todas estas cuestiones para iniciar infraestructura local. Las decisiones de seguridad e identidad que cambien el esquema deben resolverse antes de congelar su migración productiva. Si el CCFV acepta explícitamente los defaults, registrarlo en este documento y continuar sin pedir la misma confirmación nuevamente.

## 19. Mejoras futuras

Priorizar después de observar el uso de las primeras rondas:

1. **Archivo CCFV:** página de funciones proyectadas, fecha, película, ciclo y resultado de origen; luego flyer, artículo y fotos con almacenamiento R2 y permisos editoriales sencillos.
2. **Apoyo a propuestas existentes:** solo si los miembros necesitan expresar interés antes de las rondas; mantenerlo separado de votar.
3. **Selección de hasta N o ranking:** con participaciones/selecciones separadas, modalidad versionada y explicación del conteo. No agregar ambas a la vez sin evidencia.
4. **Exportación administrativa CSV:** agregados por grupo y ronda, minimizando datos personales; sin exportar credenciales ni historiales nominales de votos por defecto.
5. **Curaduría:** filtros simples por año, duración o director; reutilizar candidatas y copiar un borrador de ronda conservando IDs de películas, sin copiar votos.
6. **Mejoras operativas:** passkeys administrativas si Access deja de encajar, alertas mejores o controles de tasa más estrictos solo si el volumen los justifica.
7. **Privacidad:** automatizar seudonimización de miembros desvinculados y solicitudes de eliminación preservando estadísticas; revisar decisiones de retención con experiencia real.

**Primera tarea del siguiente agente:** ejecutar 0.1–0.3 para obtener Astro en runtime Cloudflare, D1 local migrada y una prueba de integración que demuestre la unicidad de voto y el rechazo tras cierre. Esa base debe quedar comprobada antes de dedicar esfuerzo al panel o a la interfaz pública.
