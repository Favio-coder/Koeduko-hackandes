import { Button, Card } from "@/components/ui";

export default function AssessmentCompleted({ title, courseName, onDone }) {
  return (
    <Card title="¡Evaluación completada!">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <img
          src="/logo/logoKoedukosinfondo.png"
          alt="Mascota KoEduko"
          className="h-20 w-20 shrink-0 object-contain"
        />
        <div className="min-w-0 space-y-2">
          {courseName && (
            <p className="text-sm font-semibold text-[#2A7A35]">
              {courseName}
            </p>
          )}
          <p className="font-bold text-[#304744]">{title}</p>
          <p role="status">
            Tus respuestas se enviaron correctamente. Este intento ya no se
            puede modificar.
          </p>
          <Button onClick={onDone}>Volver a mis evaluaciones</Button>
        </div>
      </div>
    </Card>
  );
}
