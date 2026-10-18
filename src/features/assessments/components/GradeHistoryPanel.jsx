import { Alert, Button, Card } from "@/components/ui";

const statusLabels = {
  graded: "Corregida",
  pending: "Pendiente de entrega",
  in_progress: "En curso",
  incomplete: "Incompleta",
};

function displayScore(score) {
  return Number.isFinite(score) ? score.toFixed(2).replace(/\.?0+$/, "") : "—";
}

export default function GradeHistoryPanel({
  initial,
  teacher = false,
  onDone,
}) {
  const records = initial.records || [];
  const averages = initial.averages || [];
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#2A7A35]">
            {teacher ? "Seguimiento académico" : "Mi aprendizaje"}
          </p>
          <h2 className="text-2xl font-bold text-[#304744]">
            {teacher ? "Calificaciones por área" : "Mis calificaciones"}
          </h2>
        </div>
        {onDone && (
          <Button variant="ghost" onClick={onDone}>
            Volver
          </Button>
        )}
      </header>

      {!records.length && (
        <Card title="Aún no hay calificaciones">
          <p>
            Las evaluaciones calificadas aparecerán aquí. Las que estén
            pendientes no se cuentan como cero.
          </p>
        </Card>
      )}

      {!!averages.length && (
        <section aria-label="Promedios por área" className="grid gap-3 sm:grid-cols-2">
          {averages.map((average) => (
            <Card
              key={`${average.studentId}:${average.courseId}:${average.areaId}`}
              className="border-l-4 border-l-[#304744]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  {teacher && (
                    <p className="font-semibold text-[#304744]">
                      {average.studentName}
                    </p>
                  )}
                  <p className="text-sm text-[#5A6B6A]">
                    {average.courseName} · {average.areaName}
                  </p>
                </div>
                <p className="shrink-0 text-2xl font-bold tabular-nums text-[#304744]">
                  {average.average20 == null
                    ? "—"
                    : `${displayScore(average.average20)} / 20`}
                </p>
              </div>
              <p className="mt-2 text-xs text-[#5A6B6A]">
                {average.gradedCount} calificada(s) · {average.pendingCount}{" "}
                pendiente(s) ·{" "}
                {average.method === "weighted"
                  ? "ponderado"
                  : "promedio aritmético"}
              </p>
              {average.configurationError && (
                <Alert tone="warning" title="Revisar ponderaciones">
                  {average.configurationError}
                </Alert>
              )}
            </Card>
          ))}
        </section>
      )}

      {!!records.length && (
        <Card title="Historial de evaluaciones">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <caption className="sr-only">
                Historial de notas, estados y fecha de corrección
              </caption>
              <thead>
                <tr className="text-[#5A6B6A]">
                  {teacher && <th scope="col" className="p-3">Estudiante</th>}
                  <th scope="col" className="p-3">Área</th>
                  <th scope="col" className="p-3">Evaluación</th>
                  <th scope="col" className="p-3">Puntaje bruto</th>
                  <th scope="col" className="p-3">Nota / 20</th>
                  <th scope="col" className="p-3">Estado</th>
                  <th scope="col" className="p-3">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr
                    key={`${record.studentId}:${record.assessmentId}`}
                    className="border-t border-[#E6EAE3]"
                  >
                    {teacher && (
                      <th scope="row" className="p-3 font-semibold">
                        {record.studentName}
                      </th>
                    )}
                    <td className="p-3">
                      <span className="block">{record.areaName}</span>
                      {!teacher && (
                        <span className="text-xs text-[#5A6B6A]">
                          {record.courseName}
                        </span>
                      )}
                    </td>
                    <td className="p-3">{record.assessmentTitle}</td>
                    <td className="p-3 tabular-nums">
                      {record.rawScore == null
                        ? "—"
                        : `${record.rawScore} / ${record.maxScore}`}
                    </td>
                    <td className="p-3 font-semibold tabular-nums">
                      {record.score20 == null
                        ? "—"
                        : `${displayScore(record.score20)} / 20`}
                    </td>
                    <td className="p-3">{statusLabels[record.gradeStatus]}</td>
                    <td className="p-3">
                      {record.gradedAt
                        ? new Date(record.gradedAt).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
