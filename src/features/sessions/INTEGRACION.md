# Evaluación → agrupamiento → sala privada

1. El docente asigna un diagnóstico a los alumnos elegidos. Solo esos alumnos lo envían.
2. Completa la corrección y finaliza esa evaluación. Las demás pruebas no participan.
3. En Emparejamiento selecciona curso/evaluación y pulsa Agrupar.
4. En Resultados revisa los integrantes y pulsa Crear salas para estos grupos.
5. La API autenticada valida contra Firestore y guarda, en una transacción, la confirmación y una learningSession por pareja/trío.
6. Ver salas conserva curso/evaluación en la URL. Sus salas en Estudiantes filtra también por alumno.
7. Salas y Principal del estudiante leen las learningSessions reales. El alumno consulta por studentIds array-contains su UID; el docente por createdBy.
8. Ver detalle abre la sesión privada existente, que mantiene sus suscripciones, tutor, invitación del bot y cierre.
9. El docente dueño registra un enlace válido de Google Meet antes de iniciar la sala. No se genera un Meet ficticio ni se inicia un bot automáticamente.

## Persistencia

- matchingResults/confirmed-<hash>: dueño, curso, evaluación, huellas de evidencia/distribución y sessionIds.
- groups/<groupId>: integrantes, nombres reales y foco. pairs/<groupId> solo existe para parejas.
- learningSessions/<id>: createdBy, studentIds (UIDs), members, groupId, pairId o null, curso/evaluación, createdAt del servidor, estado scheduled, meetingUrl y currentProblem inicialmente null.
- Las respuestas del examen no se copian a la sala. El módulo en vivo conserva el contrato de currentProblem y private/answer cuando se asigne una actividad mediante su flujo correspondiente.

La identidad, nombres y resultados se verifican en el servidor. Confirmaciones repetidas/concurrentes reutilizan los mismos ids. Las salas ya existentes no se sobrescriben; una distribución distinta o evidencia recalificada exige revisar las salas confirmadas. Un fallo no deja una publicación parcial.

## Ejecución

La nueva API vive en el despliegue raíz, junto a /api/assessments. Usa la misma FIREBASE_SERVICE_ACCOUNT_JSON, sin secretos nuevos en VITE_* ni cambios de entorno. Para probar APIs localmente se requiere vercel dev. El backend independiente de sesiones/tutor sigue configurado mediante src/services/serverApi; no se despliega ni se modifica con esta unión.

Las reglas existentes de learningSessions permiten a cada estudiante leer únicamente sesiones donde figure su UID. La interfaz no otorga permisos a otros estudiantes. La cuenta docente lista sus propias salas; las reglas preexistentes mantienen el acceso amplio de docentes, sin cambios en esta integración.

Pruebas automáticas: flujo de dos y seis alumnos, tríos, reintentos/concurrencia, cobertura de asignados, evidencia recalificada, permisos del endpoint, consultas por usuario y navegación hasta sesión privada. Los dobles de Firestore y Auth evitan crear datos reales durante las pruebas.
