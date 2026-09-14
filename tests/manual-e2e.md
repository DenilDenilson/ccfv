# Prueba E2E visible — 13 de septiembre de 2026 (Lima)

Ejecutada manualmente mediante automatización del navegador integrado de Codex contra Astro en http://localhost:4321. No es una suite automatizada ni una auditoría de seguridad. Se usó D1 local y consultas reales a TMDB.

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
13. Consultar nuevamente Perfect Blue desde el formulario: aparece la ficha de TMDB con póster, metadatos, sinopsis e IMDb ID; el envío queda bloqueado hasta confirmarla.
14. El panel administrativo muestra la allowlist separada de administradores de Cloudflare Access y los estados operativos en español.

## Fallos y observaciones pendientes

- El panel muestra dos filas «Bianca»: el seed anterior se ejecutó antes y después de cambiar el secreto HMAC y creó dos identidades. No se borraron datos durante esta prueba.
- La base local conserva datos de prueba; deben recrearse o limpiarse antes de probar una migración de staging.

## Límites y datos conservados

No se probaron Turnstile con claves reales, concurrencia, límites con la cabecera `CF-Connecting-IP`, todos los permisos de endpoints ni Cloudflare Access remoto. No afirmar que el MVP está listo para producción por este recorrido hasta completar la configuración de Cloudflare.

Los votos de ambos grupos se emitieron intencionalmente desde el mismo navegador, con logout intermedio, para recorrer las dos experiencias; esto no representa dos personas verificadas. No se probó la conversión inversa de público a miembro.

Se conservaron las dos propuestas aprobadas, la ronda cerrada con resultados publicados y la función simulada en D1 local. No se desplegó ni escribió en Cloudflare remoto. La pestaña de resultados y el servidor local quedan disponibles para inspección.
