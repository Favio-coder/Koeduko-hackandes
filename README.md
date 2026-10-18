# 🐨 KoEduko

**Aprendizaje entre pares impulsado por optimización combinatoria y agentes de IA.**

KoEduko es una plataforma EdTech que identifica conocimientos complementarios entre estudiantes, forma grupos de aprendizaje optimizados y facilita tutorías colaborativas con agentes inteligentes.

## El problema

La formación manual de grupos no siempre considera las fortalezas y dificultades individuales. KoEduko propone aprovechar esos conocimientos complementarios para ampliar las oportunidades de apoyo académico y facilitar el seguimiento docente.

## ¿Cómo funciona?

1. **Diagnóstico:** evalúa seis destrezas matemáticas y genera perfiles de conocimiento.
2. **Matching inteligente:** utiliza el algoritmo de Edmonds (Blossom) para optimizar parejas y tríos según complementariedad, restricciones y cobertura de apoyo.
3. **Tutor IA:** participa en sesiones de Google Meet mediante Recall.ai, detecta señales de dificultad o baja participación y genera intervenciones guiadas con Gemini.
4. **Analítica:** registra evidencias formativas por competencia y genera reportes para el docente.

## Arquitectura tecnológica

| Componente | Tecnologías |
|---|---|
| Frontend | React 19, Vite 8, Tailwind CSS 4 |
| Backend | Node.js, Vercel Serverless Functions |
| Autenticación y datos | Firebase Auth, Cloud Firestore |
| Optimización | Edmonds Blossom, Web Workers |
| Agentes inteligentes | Gemini, Recall.ai, Deepgram |
| Memoria y voz | AtomicMemory, ElevenLabs (experimental) |
| Videoconferencias | Google Meet |

**Diseño técnico:** arquitectura modular, lógica determinista para las decisiones pedagógicas, validación de intervenciones de IA, control de acceso por roles y procesamiento incremental de eventos.

## Validación y tracción

Durante Hack The Andes 2026 se realizaron pruebas funcionales con participantes externos al desarrollo y una entrevista de tracción para recoger retroalimentación sobre la propuesta educativa.

🎥 **[Ver entrevista y evidencia de tracción](https://uncpedu-my.sharepoint.com/:v:/g/personal/e_2024100594i_uncp_edu_pe/IQCY9K3vlVJOQI3Q5-QO-CZlAXnqMZBXm4GcJb-bVjedvHk?e=uybLs8)**

La validación técnica no constituye todavía evidencia de mejora del rendimiento académico. El impacto educativo requiere pilotos con estudiantes y evaluación comparativa.

## Calidad técnica

- **1,417 pruebas automatizadas:** 1,416 aprobadas y una pendiente en la versión analizada.
- Matching contrastado con un oráculo de enumeración exhaustiva.
- Backend de sesiones con 30 módulos de lógica pura y 8 adaptadores.
- Procesamiento de eventos en tiempo real con mecanismos de idempotencia y control de errores.

## Equipo

| Rol | Responsabilidad |
|---|---|
| Product & Education Lead | Producto y enfoque pedagógico |
| Matching Algorithm Developer | Optimización combinatoria |
| AI Agents Developer | Agentes y sesiones inteligentes |
| Full Stack & Integration Developer | Integración, frontend y backend |

---

**KoEduko — Conectamos conocimientos, multiplicamos oportunidades de aprendizaje.**