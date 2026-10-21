import { useEffect, useRef, useState } from 'react'
import { Alert, Badge, Button, Card, ConfirmDialog } from '@/components/ui'
import { forgetMemoryNote } from '../services/memoryNotesService'

const STATUS_META = {
  saved: { label: 'Guardada para el tutor', tone: 'success' },
  failed: { label: 'No se guardó', tone: 'warning' },
  skipped: { label: 'Sin identificar: no se guardó', tone: 'neutral' },
  forgotten: { label: 'Olvidada', tone: 'neutral' },
}

/**
 * «Lo que recordará el tutor»: la nota corta que el cierre guardó de cada estudiante (en AtomicMemory o en el respaldo) y
 * que el tutor leerá en la próxima sala. El docente la revisa y, si no es cierta (p. ej. la transcripción confundió a dos
 * niños), la olvida: el servidor borra ese registro y el tutor deja de verlo.
 *
 * Una nota solo aparece «Olvidada» cuando el servidor lo confirma. Si la memoria no responde, se dice que SIGUE guardada.
 * Los cambios locales y las respuestas en vuelo pertenecen a una sala y a una cuenta (`scope`): si el docente cambia de
 * cuenta o de sala, una respuesta tardía no se aplica a la pantalla nueva.
 *
 * @param {{
 *   sessionId: string, uid: string|null|undefined, notes: object[]|undefined, names?: Record<string, string>,
 *   canForget: boolean, forget?: typeof forgetMemoryNote,
 * }} props
 */
export default function MemoryNotes({ sessionId, uid, notes, names = {}, canForget, forget = forgetMemoryNote }) {
  const scope = `${uid ?? ''}:${sessionId ?? ''}`
  const scopeRef = useRef(scope)
  const [local, setLocal] = useState({ scope, forgotten: {}, error: null, pending: null, confirming: null })

  useEffect(() => {
    scopeRef.current = scope
  }, [scope])

  const state = local.scope === scope ? local : { scope, forgotten: {}, error: null, pending: null, confirming: null }
  const update = (patch) => setLocal((previous) => ({ ...(previous.scope === scope ? previous : { scope, forgotten: {}, error: null, pending: null, confirming: null }), ...patch }))

  if (!Array.isArray(notes) || notes.length === 0) return null

  const handleForget = async (key) => {
    const requestScope = scope
    update({ pending: key, error: null })
    try {
      await forget({ sessionId, key })
      if (scopeRef.current !== requestScope) return
      setLocal((previous) => (previous.scope === requestScope ? { ...previous, pending: null, confirming: null, forgotten: { ...previous.forgotten, [key]: true } } : previous))
    } catch (failure) {
      if (scopeRef.current !== requestScope) return
      setLocal((previous) => (previous.scope === requestScope ? { ...previous, pending: null, confirming: null, error: { key, message: failure.message } } : previous))
    }
  }

  const confirming = notes.find((note) => note.key === state.confirming)

  return (
    <Card title="Lo que recordará el tutor" description="Notas guardadas para ayudar al tutor en próximas salas. Puedes eliminar el registro de esta sesión si es incorrecto.">
      <ul className="space-y-3" aria-label="Notas guardadas para el tutor">
        {notes.map((note) => {
          const status = state.forgotten[note.key] ? 'forgotten' : note.status
          const meta = STATUS_META[status] ?? STATUS_META.failed
          const name = names[note.key] ?? note.key
          return (
            <li key={note.key} className="min-w-0 rounded-xl border border-[#E3EAE8] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[#304744]">{name}</span>
                <Badge tone={meta.tone} size="sm">{meta.label}</Badge>
              </div>
              <p className={`mt-1.5 break-words text-sm ${status === 'forgotten' ? 'text-[#8A9998] line-through' : 'text-[#5A6B6A]'}`}>{note.text}</p>
              {note.forgetUnavailable === 'primary-unconfirmed' && (
                <p className="mt-2 text-sm text-[#5A6B6A]">La memoria principal no confirmó el guardado y la nota quedó en el respaldo. Podría existir otra copia, así que aquí no se puede confirmar su borrado.</p>
              )}
              {canForget && status === 'saved' && note.forgettable && (
                <Button
                  variant="dangerSoft"
                  size="sm"
                  className="mt-2"
                  loading={state.pending === note.key}
                  disabled={Boolean(state.pending)}
                  onClick={() => update({ confirming: note.key, error: null })}
                >
                  Olvidar esta nota
                </Button>
              )}
              {state.error?.key === note.key && (
                <Alert tone="error" className="mt-2">
                  {state.error.message}
                </Alert>
              )}
            </li>
          )
        })}
      </ul>
      <ConfirmDialog
        open={Boolean(confirming)}
        onClose={() => update({ confirming: null })}
        onConfirm={() => confirming && handleForget(confirming.key)}
        loading={Boolean(state.pending)}
        title="¿Olvidar esta nota?"
        description={`Se eliminará el registro guardado de ${confirming ? (names[confirming.key] ?? confirming.key) : 'este estudiante'} en esta sala. El reporte y las notas de otras sesiones se conservan.`}
        confirmLabel="Olvidar"
      />
    </Card>
  )
}
