/**
 * joinDefaultCourse — matricula automática del estudiante recién creado.
 *
 * La matrícula vive en `assessmentCourseAccess` (solo el servidor la escribe),
 * así que el navegador la pide con la acción `selfEnroll` justo después de
 * registrarse. Nunca lanza: si el API no está desplegado (dev con `vite`), la
 * cuenta queda creada igual y el estudiante ve la pantalla de "sin cursos"
 * hasta que se le autorice a mano.
 */
import { assessmentRequest, invalidateBootstrap } from "./assessmentService";

/**
 * @returns {Promise<{courses: {id: string, name: string}[]}|null>} `null` si no
 *   se pudo matricular (API caída, curso cerrado o ya estaba dentro).
 */
export async function joinDefaultCourse() {
  try {
    const result = await assessmentRequest("selfEnroll");
    invalidateBootstrap();
    return result;
  } catch {
    return null;
  }
}
