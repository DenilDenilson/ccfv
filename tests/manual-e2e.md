# Prueba E2E visible — 13 de septiembre de 2026 (Lima)

Ejecutada manualmente mediante automatización del navegador integrado de Codex contra Astro en http://localhost:4321. No es una suite automatizada ni una auditoría de seguridad. Se usó D1 local y consultas reales a TMDB. Código probado: commit 58ba1c3.

## Recorrido verificado

1. Entrar como Bianca con el código local y navegar conservando la sesión: correcto.
2. Proponer Perfect Blue (tt0156887) y El viaje de Chihiro (tt0245429): TMDB resolvió ambas y quedaron pendientes.
3. Entrar al panel local y aprobar ambas propuestas: correcto.
4. Crear `prueba-e2e-animacion`, añadir ambas candidatas y publicar: correcto.
5. Votar como miembro por Perfect Blue y cambiar a Chihiro: elección actualizada.
6. Cerrar sesión de miembro, entrar a la ronda sin login, votar por Perfect Blue y cambiar a Chihiro: correcto.
7. Conservar un formulario público en una segunda pestaña; cerrar la ronda como admin; intentar cambiar a Perfect Blue desde el formulario antiguo: el servidor rechazó el cambio y mantuvo Chihiro.
8. Finalizar y publicar resultados: Chihiro 1 miembro / 1 público; Perfect Blue 0 / 0. Los cambios no sumaron participaciones.
9. Seleccionar Chihiro, programar para 21/09/2026 18:00 Lima en «Sala de prueba local (E2E)» y registrar una proyección simulada: persistió como screened.
10. Cerrar sesión admin y acceder a /admin: exige autenticación.
11. Código de miembro inválido: mensaje de rechazo. Código válido posterior: permite ingresar.
12. Volver a proponer Perfect Blue: muestra que ya existe una propuesta.

## Fallos y observaciones pendientes

- Falta la vista previa y confirmación de película: el formulario la promete pero envía directamente a revisión. Incumple el flujo solicitado.
- El panel muestra dos filas «Bianca»: el seed anterior se ejecutó antes y después de cambiar el secreto HMAC y creó dos identidades. No se borraron datos durante esta prueba.
- Tras finalizar resultados sigue visible «Finalizar resultados»; después de seleccionar una película continúa el botón para seleccionar la otra. Deben reflejar mejor las transiciones permitidas.
- Textos internos draft/published/closed/scheduled/screened/active aparecen en inglés.
- La fecha de programación no tiene etiqueta accesible. Se pudo registrar una proyección antes de la fecha programada; conviene pedir fecha real explícita y confirmar si fue adelantada.
- La tarjeta de ronda conserva el texto «Votación abierta» incluso después de cerrarla (observado al volver al área de miembros).

## Límites y datos conservados

No se probaron rate limiting, Turnstile, concurrencia, regeneración/desactivación de códigos, todos los permisos de endpoints ni Cloudflare Access remoto. No afirmar que el MVP está listo para producción por este recorrido.

Los votos de ambos grupos se emitieron intencionalmente desde el mismo navegador, con logout intermedio, para recorrer las dos experiencias; esto no representa dos personas verificadas. No se probó la conversión inversa de público a miembro.

Se conservaron las dos propuestas aprobadas, la ronda cerrada con resultados publicados y la función simulada en D1 local. No se desplegó ni escribió en Cloudflare remoto. La pestaña de resultados y el servidor local quedan disponibles para inspección.
