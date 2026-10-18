import { Button, Card } from "@/components/ui";
import { Input, Select, Textarea } from "@/components/ui/Field";
import IntegerInput from "./IntegerInput";

export default function QuestionEditor({
  question: q,
  index,
  count,
  skills,
  maxPoints = 20,
  errors = {},
  onChange,
  onMove,
  onRemove,
}) {
  const set = (key, value) => onChange({ ...q, [key]: value });
  const answerErrors = [errors.options, errors.correctAnswer]
    .filter(Boolean)
    .join(" ");
  return (
    <Card
      title={`Pregunta ${index + 1}`}
      description="Define el enunciado, la habilidad evaluada y su puntaje."
      className="scroll-mt-24"
      id={`question-${index + 1}`}
    >
      <div className="space-y-5">
        <Textarea
          label="Enunciado"
          value={q.prompt}
          maxLength={2000}
          rows={3}
          error={errors.prompt}
          onChange={(e) => set("prompt", e.target.value)}
          required
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            label="Tipo de pregunta"
            value={q.type}
            error={errors.type}
            onChange={(e) => {
              const type = e.target.value;
              onChange({
                ...q,
                type,
                options:
                  type === "true_false"
                    ? ["Verdadero", "Falso"]
                    : ["", "", "", ""],
                correctAnswer: 0,
              });
            }}
            options={[
              { value: "multiple_choice", label: "Opción múltiple" },
              { value: "true_false", label: "Verdadero / falso" },
            ]}
          />
          <Select
            label="Habilidad"
            value={q.skillId}
            error={errors.skillId}
            onChange={(e) => set("skillId", e.target.value)}
            options={skills.map((skill) => ({
              value: skill.id,
              label: skill.label,
            }))}
          />
          <IntegerInput
            label="Puntaje de la pregunta"
            max={maxPoints}
            value={q.maxScore}
            error={errors.maxScore}
            onValueChange={(value) => set("maxScore", value)}
            hint={`De 1 a ${maxPoints} puntos.`}
          />
        </div>
        <fieldset
          className="space-y-3 rounded-xl border border-[#E6EAE3] bg-[#F8FAF6] p-4"
          aria-describedby={
            answerErrors ? `question-${index + 1}-options-error` : undefined
          }
        >
          <legend className="px-1 text-sm font-semibold text-[#304744]">
            Alternativas
          </legend>
          <p className="text-xs text-[#5A6B6A]">
            Marca con el control de selección la única respuesta correcta.
          </p>
          {q.options.map((option, optionIndex) => (
            <div
              key={`${q.questionId}-option-${optionIndex}`}
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
            >
              <Input
                label={`Alternativa ${optionIndex + 1}`}
                value={option}
                maxLength={500}
                disabled={q.type === "true_false"}
                error={
                  errors.options &&
                  (errors.options.includes(`alternativa ${optionIndex + 1}`)
                    ? errors.options
                    : undefined)
                }
                onChange={(e) =>
                  set(
                    "options",
                    q.options.map((value, current) =>
                      current === optionIndex ? e.target.value : value,
                    ),
                  )
                }
              />
              <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm font-medium text-[#304744] focus-within:ring-2 focus-within:ring-[#4CDB59]">
                <input
                  aria-label={`Alternativa ${optionIndex + 1} es correcta`}
                  type="radio"
                  name={`correct-${q.questionId}`}
                  checked={q.correctAnswer === optionIndex}
                  onChange={() => set("correctAnswer", optionIndex)}
                  className="h-5 w-5 accent-[#304744]"
                />
                Correcta
              </label>
              <Button
                variant="ghost"
                disabled={q.type === "true_false" || q.options.length <= 2}
                aria-label={`Eliminar alternativa ${optionIndex + 1}`}
                onClick={() => {
                  const options = q.options.filter(
                    (_, current) => current !== optionIndex,
                  );
                  const correctAnswer =
                    q.correctAnswer === optionIndex
                      ? -1
                      : q.correctAnswer > optionIndex
                        ? q.correctAnswer - 1
                        : q.correctAnswer;
                  onChange({ ...q, options, correctAnswer });
                }}
              >
                Quitar
              </Button>
            </div>
          ))}
          {answerErrors && (
            <p
              id={`question-${index + 1}-options-error`}
              role="alert"
              className="text-xs font-medium text-[#9B2C2C]"
            >
              {answerErrors}
            </p>
          )}
          <Button
            variant="secondary"
            disabled={q.type === "true_false" || q.options.length >= 6}
            onClick={() => set("options", [...q.options, ""])}
          >
            Agregar alternativa
          </Button>
        </fieldset>
        <Textarea
          label="Explicación de la respuesta (opcional)"
          rows={2}
          maxLength={2000}
          value={q.explanation}
          error={errors.explanation}
          onChange={(e) => set("explanation", e.target.value)}
        />
        <div className="flex flex-wrap gap-2 border-t border-[#E6EAE3] pt-4">
          <Button
            variant="secondary"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            Subir pregunta
          </Button>
          <Button
            variant="secondary"
            disabled={index === count - 1}
            onClick={() => onMove(1)}
          >
            Bajar pregunta
          </Button>
          <Button variant="danger" onClick={onRemove}>
            Eliminar pregunta
          </Button>
        </div>
      </div>
    </Card>
  );
}
