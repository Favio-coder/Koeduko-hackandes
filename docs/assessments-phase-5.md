# KoEduko — Fase 5: integración, seguridad y Vercel

## Estado ejecutivo

- Arquitectura: la UI vive en `src/features/assessments/`, las funciones HTTP
  en `api/` y la validación, autorización y persistencia en `server/`.
- Build: `npm run build` pasa. Vite informa que el bundle principal minificado
  supera 500 kB; esto es una advertencia de tamaño, no un error.
- Lint: `npm run lint` pasa.
- Integración: 8/8 pruebas pasan usando Firebase Auth y Firestore Emulators.
- Unitarias: 98/99 pruebas pasan. La prueba pendiente es la prueba existente de
  TeacherDashboard que espera el texto “Datos de demostración”; está fuera del
  módulo de evaluaciones y no se cambió.
- E2E de navegador: no hay Playwright/Cypress ni un script E2E configurado.
  La página `/assessments` se verificó en el navegador sin sesión y redirige
  correctamente a `/login`.
- Vercel local: `vercel dev` se inició en `http://localhost:3000`; la ruta SPA
  devolvió HTML, las rutas internas de Vite devolvieron JavaScript y
  `POST /api/assessments` sin token devolvió el 401 esperado. No se afirma que
  producción haya sido desplegada o probada.
- Firestore: persistencia y reglas validadas contra emuladores. No se conectó
  ni se escribió en una base de datos de producción.

## Arquitectura y rutas

`src/` contiene la aplicación React/Vite y React Router declara `/assessments`
para usuarios con rol `teacher` o `student`. `ProtectedRoute` redirige a
`/login` si no hay sesión y a `/dashboard` si el perfil autenticado carece de
uno de esos roles.

`api/assessments.js` expone las operaciones autenticadas del módulo y
`api/assessments/matching-profile.js` expone
`GET /api/assessments/matching-profile`. Vercel detecta las funciones por su
ruta de archivo. `vercel.json` configura build/output de Vite y el fallback
SPA, excluyendo rutas `/api/`, assets estáticos y endpoints internos de Vite
(`@vite`, `@react-refresh`, `@id`, `@fs`) del rewrite. La exclusión de rutas
internas es necesaria durante `vercel dev`: si `/@react-refresh` recibe el
`index.html` en vez del módulo JavaScript, Vite puede fallar al parsear HTML
como JavaScript. No existe proxy de API en la configuración de Vite:
`npm run dev` sirve solo frontend.

La auditoría corrigió dos problemas de integración local:

1. Las rutas independientes pasaban su página como `children` a
   `DashboardLayout`, pero este solo renderizaba `<Outlet />`, que queda vacío
   cuando la ruta no está anidada. El layout ahora renderiza `children` cuando
   se proporciona y conserva `<Outlet />` para las rutas anidadas del
   dashboard. Una prueba de regresión cubre las rutas independientes.
2. El fallback SPA capturaba `/@react-refresh` y `/@vite/client` en `vercel
   dev`, devolviendo `index.html` donde se esperaba JavaScript. Se excluyeron
   las rutas internas de Vite en `vercel.json`; en la verificación, ambas
   devolvieron `200` con tipo `text/javascript`.

Sin autenticación, abrir `http://localhost:5173/assessments` lleva a `/login`.
Autenticado, el servidor Vite puede renderizar la UI, pero no proporciona las
Vercel Functions; las operaciones de datos del módulo mostrarán error de API.
Para probar frontend y API en un mismo origen se necesita `vercel dev` desde
la raíz, normalmente en `http://localhost:3000`. Se verificó que
`POST /api/assessments` alcanza la Function y devuelve `401` sin token.

## Seguridad y datos

- `server/firebaseAdmin.js` inicializa Firebase Admin desde
  `FIREBASE_SERVICE_ACCOUNT_JSON` y se importa desde endpoints del backend; no
  se importa desde `src/`.
- La identidad se verifica con Firebase ID Token, incluyendo comprobación de
  revocación. El servicio consulta rol, ACL del curso, asignación y titularidad
  desde Firestore; no confía en roles o permisos enviados por el cliente.
- `firestore.rules` deniega lectura/escritura cliente sobre
  `assessmentCourseAccess` y `assessmentModules`. La integración verifica que
  el cliente no pueda leer la definición privada, editar notas o cambiar ACL.
- El estudiante recibe preguntas públicas sin `correctAnswer` ni
  `explanation`. La definición correcta permanece en
  `assessmentModules/{id}/private/definition`; se entrega feedback de
  corrección solo según `feedbackMode` y después de la acción permitida
  (respuesta inmediata bloqueada, envío o cierre).
- El envío requiere revisión vigente y se persiste en una transacción.
  Repetir el envío final de un intento calificado devuelve el resultado
  existente. La integración prueba envíos repetidos/concurrentes.
- Los errores esperados responden con estados HTTP y mensajes sin secretos.
  Los errores internos se registran con código/nombre, sin imprimir
  credenciales ni contenido de respuestas.
- Las variables `VITE_FIREBASE_*` y la API key Firebase de cliente son visibles
  en el navegador por diseño. No se detectó importación de Firebase Admin ni
  de la cuenta de servicio desde el bundle cliente. La cuenta de servicio no
  debe tener prefijo `VITE_`.

## Firestore y estado del contrato

Auth y Firestore Emulator completan el flujo del servidor de integración:
crear/editar borrador, publicar/asignar, iniciar, guardar y enviar intentos,
calificar, persistir resultados, consultar notas y exportar el contrato v1.0.
También comprueban curso/rol, envíos duplicados, exportación incompleta y
reglas de acceso.

El contrato exportado conserva exactamente las propiedades de
StudentKnowledgeProfile v1.0 y usa puntajes brutos, resultados por
`skillId`, `mastery` y `evidenceCount`; la nota escalada se guarda aparte.

El motor de matching no tiene aún un consumidor implementado en este
repositorio: `useMatchingPreview` carga perfiles demo y `MatchingPage` lo
identifica como punto de extensión. Por ello se verificó la estructura del
contrato y su endpoint, pero **no es posible afirmar que el algoritmo real de
matching lo consuma**. No se modificó matching.

## Variables para Vercel

Configurar en el proyecto Vercel:

| Variable | Entorno | Uso |
| --- | --- | --- |
| `VITE_FIREBASE_API_KEY` | Build/client | Firebase Web SDK |
| `VITE_FIREBASE_AUTH_DOMAIN` | Build/client | Firebase Authentication |
| `VITE_FIREBASE_PROJECT_ID` | Build/client | Proyecto Firebase |
| `VITE_FIREBASE_STORAGE_BUCKET` | Build/client | Firebase Storage |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Build/client | Firebase Web SDK |
| `VITE_FIREBASE_APP_ID` | Build/client | Firebase Web SDK |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Functions/runtime, solo servidor | Firebase Admin SDK |
| `VITE_APP_LOCALE` | Build/client, opcional | Locale de interfaz |

Las variables `VITE_*` no son secretos: quedan incluidas en el bundle. Guardar
la cuenta de servicio como variable de entorno sensible/runtime en Vercel,
para los entornos necesarios; no subirla a Git, no colocarla en `.env` público
ni renombrarla con prefijo `VITE_`. Aplicar también al proyecto Firebase las
reglas e índices correspondientes.

## Guía de despliegue Vercel

1. Importar/vincular el repositorio y mantener su raíz como raíz del proyecto.
2. Usar framework Vite, build `npm run build` y directorio de salida `dist`
   (ya declarados en `vercel.json`).
3. Configurar las variables de entorno de la tabla anterior en Vercel; la
   cuenta de servicio debe estar disponible para las Functions, nunca para el
   bundle del navegador.
4. Confirmar que `api/assessments.js` y
   `api/assessments/matching-profile.js` formen parte del mismo proyecto de
   Vercel que sirve `dist`, de modo que frontend y API compartan origen.
5. Desplegar las reglas e índices de Firestore en el proyecto Firebase
   correspondiente y comprobar Auth, ACL del curso y documentos requeridos.
6. Tras el despliegue, validar inicio de sesión, `POST /api/assessments`,
   `GET /api/assessments/matching-profile` y la navegación SPA en una URL
   profunda. Esos pasos de producción están pendientes hasta disponer del
   proyecto y realizar un despliegue/verificación reales.

Para desarrollo local con API:

```bash
npx vercel login
npx vercel link
npx vercel dev
```

Este comando no se ejecutó durante la auditoría: falta Vercel CLI y el
repositorio no está vinculado. `npm run dev` (puerto 5173) y `npm run preview`
no sirven las Vercel Functions.

## Pruebas ejecutadas

```text
npm test                              98 passed, 1 failed (TeacherDashboard preexistente)
npm run test:assessments:integration  8 passed, 0 failed
npm run lint                          passed
npm run build                         passed, advertencia de bundle > 500 kB
npm ls --omit=dev --depth=0           passed
```

No existe una suite E2E automatizada. La verificación de UI del navegador en
esta auditoría fue limitada a la ruta protegida sin sesión; el flujo completo
autenticado con Firebase real y la validación de producción quedan pendientes.

## Archivos y pendientes

En esta fase se añadió este informe y se enlazó desde `README.md`. Los cambios
de implementación de evaluaciones de las fases anteriores permanecen en el
árbol de trabajo y no se revirtieron.

Pendientes reales:

1. Configurar variables en Vercel y ejecutar un despliegue para verificar las
   Functions/rutas y Auth reales; aún no probado.
2. Probar el flujo UI docente-estudiante completo con cuentas y datos Firebase
   de prueba en un E2E automatizado o manual autenticado.
3. Integrar el consumidor real de StudentKnowledgeProfile con matching cuando
   exista su motor; hoy el módulo matching sigue usando perfiles demo.
4. Corregir, fuera del alcance de evaluaciones, la expectativa obsoleta de la
   prueba de TeacherDashboard o actualizar su implementación.
5. Evaluar división del bundle principal, actualmente >500 kB minificado.
