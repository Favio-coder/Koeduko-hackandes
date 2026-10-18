import { Button, Card } from "@/components/ui";
import { Input, Select, Textarea } from "@/components/ui/Field";

export default function QuestionEditor({
  question: q,
  index,
  count,
  skills,
  onChange,
  onMove,
  onRemove,
}) {
  const set = (key, value) => onChange({ ...q, [key]: value });
  return (
    <Card title={`Pregunta ${index + 1}`}>
      <div className="space-y-4">
        <Textarea
          label="Enunciado"
          value={q.prompt}
          maxLength={2000}
          onChange={(e) => set("prompt", e.target.value)}
          required
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            label="Formato"
            value={q.type}
            onChange={(e) =>
              onChange({
                ...q,
                type: e.target.value,
                options:
                  e.target.value === "true_false"
                    ? ["Verdadero", "Falso"]
                    : ["", "", "", ""],
                correctAnswer: 0,
              })
            }
            options={[
              { value: "multiple_choice", label: "Opción múltiple" },
              { value: "true_false", label: "Verdadero / falso" },
            ]}
          />
          <Select
            label="Conocimiento"
            value={q.skillId}
            onChange={(e) => set("skillId", e.target.value)}
            options={skills.map((s) => ({ value: s.id, label: s.label }))}
          />
          <Input
            label="Puntos"
            type="number"
            min={1}
            max={1000}
            step={1}
            value={q.maxScore}
            onChange={(e) => set("maxScore", Number(e.target.value))}
          />
        </div>
        <fieldset className="space-y-3">
          <legend className="mb-2 font-semibold">
            Alternativas · marca la correcta
          </legend>
          {q.options.map((option, i) => (
            <div key={i} className="flex items-center gap-3">
              <input
                aria-label={`Alternativa ${i + 1} correcta`}
                type="radio"
                name={`correct-${q.questionId}`}
                checked={q.correctAnswer === i}
                onChange={() => set("correctAnswer", i)}
                className="h-5 w-5 accent-green-700"
              />
              <Input
                label={`Alternativa ${i + 1}`}
                value={option}
                maxLength={500}
                disabled={q.type === "true_false"}
                onChange={(e) =>
                  set(
                    "options",
                    q.options.map((o, n) => (n === i ? e.target.value : o)),
                  )
                }
              />
            </div>
          ))}
        </fieldset>
        <Textarea
          label="Explicación opcional"
          rows={2}
          maxLength={2000}
          value={q.explanation}
          onChange={(e) => set("explanation", e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            Subir
          </Button>
          <Button
            variant="secondary"
            disabled={index === count - 1}
            onClick={() => onMove(1)}
          >
            Bajar
          </Button>
          <Button variant="dangerSoft" onClick={onRemove}>
            Eliminar pregunta
          </Button>
        </div>
      </div>
    </Card>
  );
}
