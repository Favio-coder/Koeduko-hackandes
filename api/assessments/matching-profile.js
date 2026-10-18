import { adminServices } from "../../server/firebaseAdmin.js";
import { AssessmentError } from "../../server/assessments/domain.js";
import { createAssessmentService } from "../../server/assessments/service.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Usa GET." });
  }

  try {
    const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return res.status(401).json({ error: "Inicia sesión." });

    const { auth, db } = adminServices();
    let identity;
    try {
      identity = await auth.verifyIdToken(token, true);
    } catch {
      return res
        .status(401)
        .json({ error: "Sesión inválida o vencida." });
    }

    const { courseId, assessmentId } = req.query || {};
    if (
      typeof courseId !== "string" ||
      typeof assessmentId !== "string" ||
      !courseId ||
      !assessmentId
    ) {
      return res
        .status(400)
        .json({ error: "courseId y assessmentId son obligatorios." });
    }

    const contract = await createAssessmentService(db)(identity.uid, "export", {
      courseId,
      assessmentId,
    });
    return res.status(200).json(contract);
  } catch (error) {
    if (error instanceof AssessmentError)
      return res.status(error.status).json({ error: error.message });
    console.error("matching-profile-api", error.code || error.name);
    return res
      .status(500)
      .json({ error: "No se pudo generar el perfil de conocimientos." });
  }
}
