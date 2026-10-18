import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Card } from "@/components/ui";
import Modal from "@/components/ui/Modal";
import { assessmentRequest } from "../services/assessmentService";
import { useOperation } from "../hooks/useOperation";
import { statusLabels } from "../utils/forms";
import GradeHistoryPanel from "./GradeHistoryPanel";
import {
  showConfirmation,
  showSuccess,
} from "@/shared/lib/alerts";

export default function ResultsPanel({ initial, course, onDone }) {
  const navigate = useNavigate();
  const [data, setData] = useState(initial);
  const [confirm, setConfirm] = useState("");
  const [gradeHistory, setGradeHistory] = useState(null);
  const { busy, error, run } = useOperation();
  const { assessment: a, assignments } = data;
  const pending = assignments.filter((r) => !r.result).length;
  const skills = [
    ...new Set(
      assignments.flatMap((r) => r.result?.skills.map((s) => s.skillId) || []),
    ),
  ];
  const changeStatus = () =>
    run(async () => {
      await assessmentRequest(confirm, { assessmentId: a.id });
      setData(await assessmentRequest("results", { assessmentId: a.id }));
      setConfirm("");
    });
  const regrade = async (studentId) => {
    const confirmed = await showConfirmation({
      title: "Recalcular calificación",
      text: "Se volverá a calificar el último intento usando las respuestas almacenadas y la clave vigente del servidor. Si cambia, quedará un registro de auditoría.",
      confirmButtonText: "Recalcular",
      cancelButtonText: "Cancelar",
      icon: "warning",
    });
    if (!confirmed) return;
    await run(async () => {
      const result = await assessmentRequest("regrade", {
        assessmentId: a.id,
        studentId,
      });
      setData(await assessmentRequest("results", { assessmentId: a.id }));
      if (gradeHistory) {
        setGradeHistory(
          await assessmentRequest("grades", { courseId: a.courseId }),
        );
      }
      await showSuccess(
        result.changed
          ? "La calificación se actualizó y el promedio del área se recalculó."
          : "La calificación ya estaba actualizada; no hubo cambios.",
      );
    });
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="text-xl font-bold">Resultados · {a.title}</h2>
        <Button variant="ghost" onClick={onDone}>
          Volver al listado
        </Button>
      </div>
      {error && (
        <Alert tone="danger" title="No se completó la operación">
          {error}
        </Alert>
      )}
      <Card
        title={`${statusLabels[a.status]} · ${assignments.length - pending} evaluados · ${pending} pendientes`}
      >
        <p className="mb-4 text-sm">
          La matriz describe evidencia de esta evaluación, no una clasificación
          definitiva. Un mayor mastery indica más puntos logrados; compara
          conocimientos para orientar el apoyo.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-xl text-left text-sm">
            <caption className="sr-only">
              Matriz de conocimientos y evidencia por estudiante
            </caption>
            <thead>
              <tr>
                <th scope="col" className="p-3">
                  Estudiante
                </th>
                <th scope="col" className="p-3">
                  Estado / intentos
                </th>
                <th scope="col" className="p-3">
                  Puntaje bruto
                </th>
                <th scope="col" className="p-3">
                  Nota / {a.scale}
                </th>
                <th scope="col" className="p-3">
                  Nota académica / 20
                </th>
                <th scope="col" className="p-3">
                  Corrección
                </th>
                {skills.map((id) => (
                  <th key={id} scope="col" className="p-3">
                    {course.skills.find((s) => s.id === id)?.label || id}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assignments.map((r) => (
                <tr key={r.studentId} className="border-t border-gray-200">
                  <th scope="row" className="p-3">
                    {course.students.find((s) => s.id === r.studentId)?.name ||
                      r.studentId}
                  </th>
                  <td className="p-3">
                    {r.activeAttemptId
                      ? "Intento abierto"
                      : r.result
                        ? "Corregido"
                        : "Pendiente"}{" "}
                    · {r.count}
                  </td>
                  <td className="p-3">
                    {r.result
                      ? `${r.result.overallScore} / ${r.result.maxScore}`
                      : "—"}
                  </td>
                  <td className="p-3">
                    {r.result ? `${r.scaledScore} / ${a.scale}` : "—"}
                  </td>
                  <td className="p-3 font-semibold tabular-nums">
                    {r.result
                      ? `${((r.result.overallScore / r.result.maxScore) * 20).toFixed(2).replace(/\.?0+$/, "")} / 20`
                      : "—"}
                  </td>
                  <td className="p-3">
                    {r.result ? (
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void regrade(r.studentId)}
                      >
                        Recalificar
                      </Button>
                    ) : (
                      "Pendiente"
                    )}
                  </td>
                  {skills.map((id) => {
                    const s = r.result?.skills.find((s) => s.skillId === id);
                    return (
                      <td key={id} className="p-3">
                        {s ? (
                          <div>
                            <strong>{(s.mastery * 100).toFixed(1)}%</strong>
                            <div>
                              {s.score}/{s.maxScore} pts · {s.evidenceCount}{" "}
                              preguntas
                            </div>
                            <meter
                              aria-label={`${id}: mastery`}
                              value={s.mastery}
                              min={0}
                              max={1}
                              className="w-24"
                            />
                          </div>
                        ) : (
                          "Sin evidencia"
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            run(async () =>
              setGradeHistory(
                await assessmentRequest("grades", { courseId: a.courseId }),
              ),
            )
          }
        >
          Historial y promedios por área
        </Button>
        <Button
          variant="secondary"
          loading={busy}
          onClick={() =>
            run(async () =>
              setData(
                await assessmentRequest("results", { assessmentId: a.id }),
              ),
            )
          }
        >
          Actualizar resultados
        </Button>
        {a.status === "published" && (
          <Button variant="secondary" onClick={() => setConfirm("close")}>
            Cerrar evaluación
          </Button>
        )}
        {a.status === "closed" && (
          <Button disabled={pending > 0} onClick={() => setConfirm("finalize")}>
            Finalizar resultados
          </Button>
        )}
        {a.status === "finalized" && (
          <Button
            disabled={busy}
            icon="users"
            onClick={() =>
              navigate(
                `/matching?courseId=${encodeURIComponent(a.courseId)}&assessmentId=${encodeURIComponent(a.id)}`,
              )
            }
          >
            Preparar perfiles para matching
          </Button>
        )}
      </div>
      {gradeHistory && (
        <GradeHistoryPanel
          initial={gradeHistory}
          teacher
          onDone={() => setGradeHistory(null)}
        />
      )}
      {pending > 0 && (
        <Alert tone="info" title="Resultados parciales">
          Hay {pending} estudiantes sin una entrega corregida. Esta evaluación
          no puede declararse finalizada ni estar disponible para matching.
        </Alert>
      )}
      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm("")}
        dismissible={!busy}
        title={
          confirm === "close" ? "Cerrar evaluación" : "Finalizar resultados"
        }
        footer={
          <Button loading={busy} onClick={changeStatus}>
            Confirmar
          </Button>
        }
      >
        <p>
          {confirm === "close"
            ? "Se impedirán nuevos envíos y se cancelarán los intentos abiertos. Las respuestas guardadas se conservan, pero no se generarán notas para intentos incompletos."
            : "Se validarán todos los resultados y quedará disponible el contrato inmutable de matching."}
        </p>
        {error && <p role="alert">{error}</p>}
      </Modal>
    </div>
  );
}
