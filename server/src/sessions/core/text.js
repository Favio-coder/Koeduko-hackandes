/**
 * Normaliza texto para comparar: minusculas, sin tildes y con espacios colapsados.
 * Conserva la puntuacion (algunos marcadores dependen de ella).
 */
export function foldText(text) {
  if (typeof text !== 'string') return ''
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
