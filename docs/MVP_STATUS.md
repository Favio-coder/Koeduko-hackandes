# Estado real del MVP (18-oct-2026)

Qué hace el sistema hoy, quién lo dispara y qué está **verificado** (con qué datos) frente a lo que **no**. Sin adornos:
`TESTING.md` tiene el detalle de cada prueba.

## La cadena, eslabón por eslabón

| # | Eslabón | ¿Quién lo hace? | Estado |
| --- | --- | --- | --- |
| 1 | Asignar la evaluación diagnóstica y que los alumnos la rindan | Docente (existe, módulo de evaluaciones) | Existe; no es parte de este módulo |
| 2 | Agrupar por complementariedad y **crear las salas** de cada pareja/trío | El algoritmo, tras **un clic del docente** («Crear salas desde resultados») | Funciona (módulo de emparejamiento). **No es 100 % automático:** no se dispara solo al terminar la evaluación |
| 3 | Que cada alumno vea su sala | Automático (aparece en «Salas») | Funciona. **No hay aviso** (correo/notificación): el alumno tiene que entrar a la app |
| 4 | Crear la reunión de Meet | **Automático** al tocar «Crear reunión y entrar» si el docente conectó su Google | **Verificado en producción** (se creó un Meet real). Sin esa conexión, el docente pega el enlace a mano |
| 5 | Traer al tutor y **que entre sin admisión** | Automático al tocar «Entrar» | **Verificado**: el bot entra directo (acceso abierto del espacio) |
| 6 | Asignar problema y roles (quién guía / quién aprende) | Automático, desde la habilidad en foco y el diagnóstico | **Verificado** con una sala del tipo del emparejamiento (datos sintéticos) |
| 7 | El tutor habla por chat y por voz, lee la conversación, aprende qué estilo le sirve a cada alumno | Automático | **Verificado** en Meet real (chat y voz con `sent 200`; lo que se oyó lo confirma solo quien estuvo) |
| 8 | Silencio de grupo (reloj en silencio) | Automático si hay pantalla abierta o cron | Verificado con un replay; **sin cron real configurado** |
| 9 | Cierre al irse la última persona: reporte, memoria y perfil | Automático | **Verificado** |
| 10 | Análisis para el docente | El docente lo ve en la sala | **Funciona**, pero ver abajo |
| 11 | Qué ve el **alumno** al terminar | Automático (`/api/my-summary`, tarjeta «Tu sesión») | **Hecho, con tests; sin probar en vivo con un alumno real.** Solo ve SU parte, en frases amables y fijas: lo que hizo bien y qué probar la próxima vez. Sin notas, porcentajes, citas ni nada de su compañero |
| 10b | Resumen de **todas** las salas del docente | Automático al cerrar cada sala (`teacherInsights`, `/api/class-insights`, tarjeta «Lo que más cuesta en tus salas» en Salas) | Hecho; ver abajo si se probó en vivo |
| 10c | El tutor aprende de lo que pasó en **otras salas** del mismo docente | Automático (memoria por alumno + lo que más costó en otras salas) | Hecho; la línea de otras salas necesita ≥ 3 observaciones para aparecer |
| 10d | **Registro auxiliar de Matemática (Excel)** con la evidencia de la sala | El docente, con un botón en el reporte («Descargar registro auxiliar (Excel)») | **Hecho y probado en localhost** con una sala real: hojas por bimestre, nombre del alumno, observaciones con el estado de cada capacidad, una cita con su minuto y la fuente. **Los calificativos AD/A/B/C solo se escriben si el docente los elige**; LOGRO queda vacío. La plantilla oficial **no está en el repositorio** (trae nombres reales): se reproduce su estructura |
| 12 | Mapeo a la malla curricular / SIAGIE | – | **No existe.** Solo evidencia formativa por capacidad, con citas |

## Lo que no se ha probado

- Una sala **real** del emparejamiento (con alumnos reales) de punta a punta: las pruebas usaron salas de aceptación y una sintética.
- Dos personas reales en la misma reunión con el observador: se probó con una persona sola y con replays.
- Que el docente de **otra cuenta** conecte su Google (hoy solo está probada una cuenta; las demás deben estar como usuarios de prueba).
- La voz con niños de verdad, y la calidad pedagógica de lo que dice (no se evaluó con ningún niño ni docente).

## Límites que conviene conocer

- **Gemini (plan gratuito) tiene cuota por minuto:** en un cierre real respondió 429 y el reporte salió «solo con reglas».
  El cierre ahora espera y reintenta una vez; sin modelo de respaldo configurado (`GEMINI_FALLBACK_MODEL`) puede repetirse.
- **Acceso abierto del Meet:** cualquiera con el enlace puede entrar. Con menores, decidirlo conscientemente (`GOOGLE_MEET_ACCESS=TRUSTED`).
- El tutor reacciona a eventos; sin pantalla abierta ni cron, el silencio no dispara nada.
- Mientras la app de Google esté en modo «Pruebas», el permiso del docente puede caducar a los 7 días (a verificar).
- Pendientes de seguridad: rotar `RECALL_WEBHOOK_TOKEN` (se mostró en salidas de herramientas) y revocar la llave de ElevenLabs que se pegó en un chat.

## Lo que sigue (en este orden)

1. Aviso de «tu sala está lista» al alumno (correo o notificación) y probar la devolución con un alumno real.
2. Disparar la creación de salas al finalizar la evaluación, sin el clic del docente.
3. Exportar la evidencia con ids estables (capacidad/desempeño) para mapearla a la malla y al SIAGIE.
4. Probar con una sala real, dos alumnos y su docente.
