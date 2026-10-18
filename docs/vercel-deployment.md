# Despliegue de KoEduko en Vercel

## Arquitectura y destino

- React + Vite genera `dist`; Vercel sirve los archivos estáticos.
- `vercel.json` define Vite, `npm run build`, salida `dist` y fallback SPA excluyendo `/api/*`, assets y recursos de desarrollo.
- `api/assessments.js` es una Vercel Function POST. Importa `server/assessments/` y Firebase Admin; verifica ID tokens, roles, pertenencia al curso y operaciones autorizadas.
- `api/assessments/matching-profile.js` es una Function GET autenticada para exportar `StudentKnowledgeProfile` v1.0.
- Firebase Authentication y Firestore permanecen en Firebase. Admin omite Security Rules: la autorización del servicio es imprescindible.
- Matching conserva su algoritmo. Sesiones conserva su integración actual. El tutor usa la Cloud Function existente `askTutor` en `europe-west1`, con `GEMINI_API_KEY` gestionada en Firebase; publicar Vercel no publica esa función.
- Proyecto confirmado: `favio-coders-projects/koeduko-hackandes`, ID `prj_IIwd0stuEw23rjgnJ5TVw6GFXZ11`. Node configurado: `24.x` (local: 24.12.0).
- Instalación automática de npm según `package-lock.json`; para instalación local reproducible: `npm ci`.

## Variables (sin secretos)

| Nombre | Uso | Entornos |
| --- | --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON privado de cuenta de servicio; solo servidor | Production; Preview/Development si se habilitan |
| `VITE_FIREBASE_API_KEY` | Configuración pública Firebase | Cada entorno utilizado |
| `VITE_FIREBASE_AUTH_DOMAIN` | Dominio de autenticación | Cada entorno utilizado |
| `VITE_FIREBASE_PROJECT_ID` | Proyecto Firebase | Cada entorno utilizado |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage | Cada entorno utilizado |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Configuración pública | Cada entorno utilizado |
| `VITE_FIREBASE_APP_ID` | Aplicación Firebase | Cada entorno utilizado |

La cuenta de servicio debe contener `project_id`, `client_email` y `private_key` válidos; usar el JSON original de tipo `service_account`. Debe corresponder al proyecto del frontend. Conservar los saltos de línea de la clave mediante escapes JSON. Nunca usar prefijo `VITE_` para Admin.

Guardar las credenciales locales en `.env.local`. La auditoría encontró también Admin en `.env`: consolidar esa copia con autorización, sin sustituir credenciales. `.gitignore` excluye los archivos de entorno; `.vercelignore` los excluye del envío de fuentes. No imprimir valores ni pasar secretos como argumentos de shell. No subir `.env` o `.env.local`.

Para inventariar variables usar `vercel env ls --project koeduko-hackandes --scope favio-coders-projects`; evitar `--json` en una terminal visible porque puede incluir valores. Para añadir la credencial, tras autorización, usar el panel seguro o alimentar `vercel env add FIREBASE_SERVICE_ACCOUNT_JSON production --project koeduko-hackandes --scope favio-coders-projects` por stdin desde un proceso que lea `.env.local`, sin imprimir el valor. No reemplazar una variable existente sin permiso. Marcarla sensible cuando corresponda. Los cambios de variables necesitan un nuevo despliegue.

No ejecutar `vercel env pull` sobre `.env.local` sin proteger primero los valores locales existentes. `vercel link` puede renovar `VERCEL_OIDC_TOKEN` en ese archivo; no mostrarlo.

## Comandos locales

```bash
git status --short --branch
git branch --show-current
git stash list
node --version
npm ci # solo cuando sea necesaria la instalación
npm run lint
npm test
npm run test:assessments:integration
npm run build
vercel whoami
vercel project inspect koeduko-hackandes --scope favio-coders-projects
vercel dev --project koeduko-hackandes --scope favio-coders-projects --listen 127.0.0.1:3100
```

Las pruebas de integración requieren Java y emuladores Firebase. Usan exclusivamente `demo-koeduko-assessments`, no datos reales. Para el ensayo realizado se cargaron `.env` y luego `.env.local` en el entorno del proceso hijo de `vercel dev` sin imprimir valores; no usar `source` con JSON arbitrario. `npm run dev` solo inicia Vite y no ejecuta las Functions.

## Procedimiento de despliegue

1. Confirmar cuenta, proyecto existente, rama y todo el diff local. La CLI publica el directorio de trabajo, incluidos cambios sin commit y archivos nuevos no excluidos.
2. Verificar credenciales y las seis variables públicas en Production. Preview y Development necesitan su propia configuración si van a utilizarse.
3. Resolver pruebas fallidas y validar login, curso y cuentas de prueba autorizadas. Preparar documentos `users/{uid}` con roles correctos y ACL `assessmentCourseAccess/{courseId}` desde un entorno administrativo autorizado. Nunca permitir que un estudiante se otorgue rol docente.
4. Mostrar destino, cambios y resultados, y obtener autorización explícita para producción.
5. Solo después de esa autorización:

   ```bash
   vercel deploy --prod --project koeduko-hackandes --scope favio-coders-projects
   vercel inspect <URL_GENERADA> --scope favio-coders-projects
   vercel logs <URL_GENERADA> --scope favio-coders-projects
   ```

6. Registrar la URL real y el estado Ready. Comprobar runtime además del build. Revisar logs sin compartir tokens, cuerpos con datos personales ni credenciales.
7. En Firebase Authentication verificar los dominios autorizados y los proveedores utilizados. Validar primero la URL Vercel, con recarga directa en las rutas protegidas y login real.

## Verificación de endpoints y E2E

```bash
curl -i http://127.0.0.1:3100/assessments
curl -i http://127.0.0.1:3100/matching/results
curl -i http://127.0.0.1:3100/sessions
curl -i http://127.0.0.1:3100/api/assessments
curl -i -X POST -H 'Content-Type: application/json' --data '{"action":"bootstrap"}' http://127.0.0.1:3100/api/assessments
curl -i http://127.0.0.1:3100/api/assessments/matching-profile
```

Esperados: SPA 200 HTML; GET assessments 405 JSON; POST sin token 401 JSON; matching-profile sin token 401 JSON. Un 401 legítimo confirma rechazo de acceso, no inicialización de Admin ni acceso a Firestore. Sustituir la base por la URL real para producción.

Con cuentas autorizadas, desde el navegador (sin copiar tokens a logs):

- Docente: login, dashboard, borrador, publicación/asignación, consulta de resultados.
- Estudiante: login, evaluaciones asignadas, responder y enviar; comprobar persistencia tras recarga.
- Backend: autorización por curso, denegación de terceros, calificación objetiva, idempotencia de envío y resultados por conocimiento en Firestore.
- Matching: exportación GET con `courseId` y `assessmentId`, contrato v1.0; comprobar ruta de resultados.
- Sesiones: listado, detalle y acceso Meet. IA: llamada real a `askTutor` y persistencia autorizada de interacciones.

Las Security Rules e índices locales no se publican al desplegar Vercel. Comprobar que la configuración desplegada en Firebase coincide antes de declarar validación completa. No abrir acceso público para resolver errores.

## Diagnóstico de errores

- `Falta FIREBASE_SERVICE_ACCOUNT_JSON en el servidor`: variable ausente/vacía o campos incompletos en el entorno correspondiente. Configurar en Vercel y redesplegar; no mover Admin al frontend.
- JSON inválido: validar localmente sin mostrar el contenido; el parser del servidor emite un mensaje genérico para evitar revelar fragmentos secretos.
- 401: comprobar sesión/token y proyecto Firebase. 403: revisar rol y ACL. 409: conflicto de revisión, estado o límite de intentos; no convertirlo en 500.
- HTML en `/api/*`: revisar exclusión del rewrite y existencia del archivo Function.
- Recarga SPA 404: revisar rewrite y `dist/index.html`.
- OAuth correcto pero Firestore falla: comprobar IAM, base habilitada y proyecto; el intercambio OAuth por sí solo no prueba permisos Firestore.
- Login falla en Vercel: revisar configuración pública, proveedor y dominios autorizados.
- Tutor falla: comprobar despliegue de `askTutor`, región y secreto Gemini en Firebase.
- Bundle grande: aviso actual de Vite, no error de compilación. Optimizar separadamente con pruebas de los módulos.

## Dominio edukolea.com

Después de validar la URL Vercel, inspeccionar `vercel domains inspect edukolea.com --scope favio-coders-projects` y los dominios del proyecto en el panel. Registrar los valores exactos A/CNAME/TXT que Vercel indique; no asumir valores genéricos. Solicitar autorización para asociar el dominio o modificar DNS. Verificar propagación, certificado TLS y Firebase Authorized Domains. En esta preparación no se inspeccionó ni modificó el dominio; los registros concretos siguen pendientes.

## Rollback

1. Identificar un despliegue previo Ready y verificado del mismo proyecto mediante el panel o `vercel ls koeduko-hackandes --scope favio-coders-projects`.
2. Obtener autorización y ejecutar `vercel rollback <URL_PREVIA> --scope favio-coders-projects`, o el rollback desde el panel.
3. Repetir smoke tests, login y operación de lectura/escritura autorizada; confirmar aliases de producción.
4. El rollback de Vercel no revierte Firestore, Security Rules, IAM, DNS ni Cloud Functions. Evaluar compatibilidad de datos y variables; no borrar datos ni usar reset destructivo del repositorio.

## Evidencia de preparación — 17 octubre 2026

- Rama: `feature/assessments-full-stack`. Había cambios previos en 19 archivos y archivos nuevos; stash vacío. Sin commits, pushes ni despliegues realizados.
- Proyecto existente confirmado por el usuario. `vercel link` renovó el token OIDC local; la credencial Admin local se conservó.
- Vercel: seis variables públicas listadas exclusivamente en Production. Admin ausente; Preview/Development sin variables listadas. Valores remotos no validados.
- Admin local: JSON y campos presentes; proyecto coincide con frontend; inicialización y obtención OAuth correctas.
- Lint: pasa después de restaurar el manejo de `AssessmentError`.
- Vitest: 99/100 pasan. Fallo preexistente en `TeacherDashboard.test.jsx:20`: falta el texto `Datos de demostración`. No se alteró este módulo ni se debilitó la prueba.
- Integración: 8/8 pasan en emuladores tras corregir 500 indebido frente a 409. Incluye tokens, autorización, persistencia, calificación, concurrencia, reglas y contrato v1.0.
- Build: pasa; aviso de chunk principal mayor de 500 kB.
- `vercel dev`: rutas `/`, `/login`, `/assessments`, `/matching`, `/matching/results`, `/sessions`, `/sessions/test/tutor` devuelven 200 HTML. Endpoints devuelven los 401/405 JSON esperados. Servidor de prueba detenido al finalizar.
- Pendiente: login visual y flujo E2E con cuentas autorizadas, lecturas/escrituras reales en Firestore, verificación de proveedores, reglas desplegadas e IA. HTTP 200 HTML no demuestra renderizado ni funcionalidad autenticada.
- Producción: bloqueada por variable Admin ausente, prueba pendiente y validación real incompleta. No hay URL nueva de despliegue ni resultados E2E de producción.
