# KoEduko — Hoja de ruta de la hackathon

Duración asumida: **48 horas**, **3 desarrolladores en paralelo**.

## Principio rector

> Si P0 no funciona, no se hace P1 ni P2.

El objetivo de la hackathon es **demostrar el flujo de extremo a extremo**, no
demostrar efectividad educativa. **No afirmar que la plataforma mejora el
aprendizamiento**: no hay evidencia empírica.

## Prioridades

| Nivel | Alcance |
| --- | --- |
| **P0** | Firebase conectado, login, dashboard, diagnóstico, emparejamiento, sesiones con Meet, flujo completo demostrable |
| **P1** | Tutor IA, explicaciones de parejas, métricas, mejoras visuales |
| **P2** | Reuniones automáticas, agentes adicionales, reportes, interoperabilidad SIAGIE |

---

## Cronograma

### Fase 0 — Base compartida (hecha)
Arquitectura, estructura, contratos, router, layouts, reglas, servidor base.

### Fase 1 — Horas 0–4 · En paralelo

| Dev | Actividad |
| --- | --- |
| DEV 1 | CRUD de estudiantes y aulas, estados de carga/error/vacío, responsive |
| DEV 2 | Items del diagnóstico + `computeKnowledgeProfile` |
| DEV 3 | Persistencia de `learningSessions` + `isValidMeetUrl` |

**Hito H1:** cada módulo tiene datos reales de Firestore (o mocks coherentes).

### Fase 2 — Horas 4–14 · En paralelo

| Dev | Actividad |
| --- | --- |
| DEV 1 | `promoteToTeacher`, dashboard docente con datos reales |
| DEV 2 | `complementarityScore` + `matchStudents` exacto + pruebas |
| DEV 3 | Crear sesión con enlace de Meet + estados + participación |

**Hito H2 (crítico):** el emparejamiento funciona y está probado. Sin esto el flujo no avanza.

### Fase 3 — Horas 14–26 · Integración del flujo

| Dev | Actividad |
| --- | --- |
| DEV 1 | Dashboard docente consume matching y sesiones |
| DEV 2 | `MatchingPage` completa + `MatchingResultsPage` + persistencia |
| DEV 3 | Desplegar `askTutor`, tutor con pistas progresivas |

**Hito H3:** el flujo completo se puede demostrar de principio a fin.

### Fase 4 — Horas 26–38 · P1

| Dev | Actividad |
| --- | --- |
| DEV 1 | Métricas y resultados agregados |
| DEV 2 | Explicaciones pedagogy por pareja, restricciones adicionales |
| DEV 3 | Historial de interacciones, recomendaciones al docente |

### Fase 5 — Horas 38–44 · Endurecimiento

| Todos | Lint, tests, build, reglas de Firestore, emuladores, datos demo |
| — | Corregir errores; **declarar explícitamente lo no verificado** |

### Fase 6 — Horas 44–48 · Demo

- Ensayo de la demostración dos veces.
- Verificar que la demo corre en modo incógnito (o emulador).
- Documentar qué funciona y qué no.

---

## Flujo de demo objetivo (5 minutos)

1. Login como docente → dashboard.
2. Ver aula y estudiantes.
3. Abrir diagnóstico → 5 estudiantes responden (simulado).
4. Ejecutar emparejamiento → 2 parejas + 1 sin pareja.
5. Revisar y confirmar parejas.
6. Crear sesión, pegar enlace de Meet.
7. Abrir como estudiante → unirse a la reunión.
8. Consultar al tutor IA una pista.
9. Volver al docente → ver resultados y participación.

---

## Entregables

| # | Entregable | Responsable | Deadline |
| --- | --- | --- | --- |
| E1 | Repositorio con arquitectura y documentación | Arquitectura | H4 |
| E2 | Login + rutas protegidas funcionando | DEV 1 | H14 |
| E3 | Diagnóstico con perfiles de conocimiento | DEV 2 | H14 |
| E4 | Algoritmo de emparejamiento + pruebas | DEV 2 | H26 |
| E5 | Sesiones con enlace de Google Meet | DEV 3 | H26 |
| E6 | Tutor IA (si se llegó) | DEV 3 | H38 |
| E7 | Lint, tests y build verdes | Todos | H44 |
| E8 | Demo ejecutada sin fallos críticos | Todos | H48 |

---

## Riesgos y mitigación

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Reglas de Firestore bloquean escrituras del DEV | Alto | Usar emuladores desde el inicio; probar reglas antes de desplegar |
| Google Meet: no hay API de creación sin OAuth | Medio | Fase 1 es **enlaces manuales**; no simular reuniones |
| Gemini sin cuota o sin clave | Medio | El flujo P0 no depende del tutor; es P1 |
| Conflicto en `contracts.js` | Alto | Coordinar antes de tocarlo |
| `package-lock.json` en conflicto | Medio | Nunca resolver a mano; regenerar |
| Emparejamiento lento con clases grandes | Bajo | Máximo 30 estudiantes; exacto es viable |
| Alcance desmedido | **Crítico** | Regla estricta P0 antes que P1 |

## Decisiones técnicas pendientes

1. ¿Quién promueve a docente: endpoint del servidor (`server/`) con secreto de invitación o consola?
   → **DEV 1 decide en H4**, lo documenta en `API_CONTRACTS.md`.
2. ¿Algoritmo exacto o greedy? → **DEV 2 decide en H10**. Si es greedy, declarar
   que no garantiza optimalidad en el código y en la UI.
3. ~~Región de Functions~~ — ya no aplica: no hay Cloud Functions (plan Spark); el backend es `server/` en Vercel.

---

## Qué **no** se afirmará en la entrega

- Que la plataforma mejora el aprendizaje (no hay estudio).
- Que las reuniones de Google Meet se crean automáticamente (solo se registran).
- Que Gemini está integrado si no se desplegó y probó.
- Que el emparejamiento es óptimo si se usó una heurística.