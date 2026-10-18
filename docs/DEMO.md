# Demo de 3 minutos: el agente en una sesión de Meet

Guion para mostrar el ciclo **escucha → interviene → cierra** del tutor. Lo que se puede afirmar y lo que no está en
`TESTING.md`: **no digas nada que esté en su sección 3**. En particular, el ciclo completo con una conversación de
matemática real **todavía no se ha ejecutado de punta a punta**; por eso este guion trae un plan B.

## Antes de empezar (10 minutos antes)

1. `npm run check:env` desde `server/` con `--vercel production`: no debe faltar ninguna obligatoria.
2. Las reglas de Firestore desplegadas (`firebase deploy --only firestore:rules --project koeduko-app`).
3. Una sesión de prueba creada (`server/scripts/createAcceptanceSession.js`) con el enlace del Meet de hoy, y un
   docente con `users/{uid}.role == "teacher"`.
4. Tres personas: el **anfitrión** (docente) y dos **invitados** que entran como **«Estudiante A»** y **«Estudiante B»**
   (el nombre exacto: la memoria y el reporte dependen de él).
5. Entrar a la app con la cuenta docente en la URL desplegada y comprobar que carga el login.

## Dos accesos desde el login

El login trae una tarjeta **«Demostración»** con los dos caminos de siempre:

- **Ingresa como docente**: entra directo con la cuenta de la demo
  (`faviusam@gmail.com`), sin escribir nada. La credencial viaja en el bundle del
  navegador, así que es pública: es una cuenta de demo, nunca una real.
- **Ingresa como estudiante**: lleva al registro. La cuenta nueva se crea con rol
  estudiante y el servidor la matricula sola en el curso de matemática
  (`selfEnrollment: true` en `assessmentCourseAccess/{courseId}`, o el único curso
  del catálogo); al entrar, el panel del estudiante confirma «Ya estás en
  Matemática». Ese camino necesita el backend desplegado: en `vite` la cuenta se
  crea igual, pero la matrícula hay que hacerla a mano.

Orden en la reunión: entran los dos Estudiantes y el anfitrión los admite → el docente pulsa **«Invitar tutor»** →
el anfitrión admite a **«Tutor KoEduko»** → **el anfitrión sale del Meet** (si se queda, el tutor lo cuenta como un
participante callado y le habla a él). Los Estudiantes se quedan hasta que termine la demo: si todos salen, el bot se
va solo a los 2 segundos.

## Guion (3:00)

| Tiempo | Qué pasa | Qué decir |
| --- | --- | --- |
| **0:00** | La pantalla de la sesión: el problema («Hay 6 cajas con 8 lápices cada una. ¿Cuántos lápices hay en total?») y el menú **Sesión activa**. | «Una pareja de quinto de primaria resuelve un problema en Meet. El tutor es un participante más: escucha y, a veces, pregunta.» |
| **0:25** | **Invitar tutor**; el estado pasa a «Tutor en la reunión». | «Entra como un participante. No resuelve nada: su trabajo es que se expliquen entre ellos.» |
| **0:45** | **A** lee el problema y razona en voz alta, sin dar el resultado, durante ~1 min. **B** calla. | «Aquí uno habla y el otro no.» Mostrar el reparto de palabra en la pantalla. |
| **1:30** | El tutor interviene (`SILENT_PEER`). Aparece en el panel «Lo que dijo el tutor» y en el **chat de Meet**. | «Lo decidió una regla, no un modelo: B habló 0 % del tiempo. El modelo solo redactó la pregunta.» Leer el «Porque: …». |
| **1:50** | **B**: «son cuarenta y seis». El tutor pide verificar un paso. | «Nunca dice cuál es la respuesta, ni que está mal.» |
| **2:15** | **B**: «seis por ocho, cuarenta y ocho, porque son seis cajas de ocho». | «Ahora justifica. Eso queda como evidencia.» |
| **2:30** | **Cerrar sesión** (docente). Aparece el reporte. | «El reporte es **evidencia formativa por capacidad**, con citas y minuto. **La calificación la decide el docente.**» Señalar el aviso en pantalla. |
| **2:50** | Cierre. | Decir qué falta: ver «Qué decir sobre los límites». |

## Qué decir sobre los límites (sin que te lo pregunten)

- «Funciona sobre 5 señales. Cuando ninguna salta, el tutor calla.»
- «La transcripción automática se equivoca con nombres y números.»
- «No hemos medido ningún efecto sobre el aprendizaje, ni lo probamos aún con niños.»
- Sobre la **memoria entre sesiones**: «está implementada y probada por piezas; el ciclo completo aún no se ha
  ejecutado de punta a punta.» No la muestres en vivo si no se probó antes.

## Plan B: si Meet o el bot fallan

Reproducir la reunión real anonimizada (`server/fixtures/smoke-001.json`, ~110 s, 3 participantes) contra el webhook
desplegado. Es la **única conversación real** que tenemos y **no es de matemática**: mostrará la intervención
`SILENT_PEER` y el reparto de palabra, no las respuestas ni el reporte con datos reales.

```bash
node server/scripts/replayFixture.js --session smoke-replay-demo --speed 4
```

Luego abrir `/sessions/smoke-replay-demo` con la cuenta docente. Dile al público qué es: «esta es la reunión real que
grabamos el 17 de octubre, reproducida.» No lo presentes como una sesión en vivo.

## Riesgos de la demo

| Riesgo | Qué hacer |
| --- | --- |
| El anfitrión tarda en admitir al bot (en la prueba tardó ~5 min). | Invitar al tutor **antes** de empezar a hablar; no empezar el reloj hasta que esté dentro. |
| El tutor no interviene (ninguna señal salta). | Cumplir el guion: B calla ≥ 1 min y A habla; y plan B. |
| La transcripción no capta «cuarenta y seis». | Hablar claro y despacio, con una pausa entre frases; repetir. |
| El mensaje no aparece en el chat de Meet. | Nunca se vio en vivo; el panel de la app sí lo muestra. No prometerlo antes de verlo. |
| La pantalla dice «No tienes permiso». | Reglas sin desplegar, o la cuenta no es docente. |
| La página sale en blanco. | Faltan las variables `VITE_FIREBASE_*` del despliegue (ver `README.md`, sección de variables). |
| Gemini falla o tarda. | No pasa nada visible: sale el mensaje de respaldo (de forma determinista). |
