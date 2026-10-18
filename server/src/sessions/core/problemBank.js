/**
 * Banco de problemas por habilidad. PURO y determinista: el mismo (habilidad, semilla) da siempre el mismo problema.
 *
 * Sirve para que una sala creada por el algoritmo de emparejamiento NO nazca sin actividad: el docente no tiene que
 * escribir un problema, el servidor toma la habilidad en foco del grupo y le asigna uno de nivel 5.º-6.º de primaria.
 * La respuesta siempre es un numero entero y NUNCA aparece en el enunciado (viaja aparte, en private/answer).
 */

import { seededUnit } from './learning.js'

const FALLBACK_SKILL = 'multiplication'

/** Entero en [min, max] estable para (semilla, etiqueta). */
const intIn = (seed, label, min, max) => min + Math.floor(seededUnit(`${seed}:${label}`) * (max - min + 1))
const pick = (seed, label, list) => list[Math.floor(seededUnit(`${seed}:${label}`) * list.length)]

const BUILDERS = Object.freeze({
  addition(seed) {
    const a = intIn(seed, 'a', 120, 480)
    const b = intIn(seed, 'b', 130, 450)
    const [one, two] = pick(seed, 'what', [['libros de cuentos', 'libros de ciencias'], ['manzanas rojas', 'manzanas verdes'], ['cuadernos azules', 'cuadernos rojos']])
    return { text: `En la tienda hay ${a} ${one} y ${b} ${two}. ¿Cuántos hay en total?`, expectedAnswer: a + b }
  },
  subtraction(seed) {
    const a = intIn(seed, 'a', 300, 900)
    const b = intIn(seed, 'b', 100, a - 80)
    const thing = pick(seed, 'what', ['cuadernos', 'botellas de agua', 'panes'])
    return { text: `Una tienda tenía ${a} ${thing} y vendió ${b}. ¿Cuántos le quedan?`, expectedAnswer: a - b }
  },
  multiplication(seed) {
    const boxes = intIn(seed, 'a', 4, 9)
    const each = intIn(seed, 'b', 6, 12)
    const [box, thing] = pick(seed, 'what', [['cajas', 'lápices'], ['bolsas', 'caramelos'], ['canastas', 'naranjas']])
    return { text: `Hay ${boxes} ${box} con ${each} ${thing} cada una. ¿Cuántos ${thing} hay en total?`, expectedAnswer: boxes * each }
  },
  division(seed) {
    const kids = intIn(seed, 'n', 3, 8)
    const each = intIn(seed, 'q', 4, 12)
    const thing = pick(seed, 'what', ['caramelos', 'figuritas', 'galletas'])
    return { text: `Se reparten ${kids * each} ${thing} en partes iguales entre ${kids} niños. ¿Cuántos recibe cada niño?`, expectedAnswer: each }
  },
  fraction(seed) {
    const quarter = intIn(seed, 'k', 3, 15)
    const liters = quarter * 4
    return { text: `Un tanque de ${liters} litros está lleno hasta la cuarta parte. ¿Cuántos litros de agua tiene?`, expectedAnswer: quarter }
  },
  estimation(seed) {
    // Tres cantidades cerca de una decena: se pide la suma redondeando cada una a la decena mas cercana.
    const tens = [intIn(seed, 't1', 2, 6), intIn(seed, 't2', 2, 6), intIn(seed, 't3', 2, 6)]
    const near = tens.map((t, i) => t * 10 + intIn(seed, `d${i}`, -3, 3))
    return {
      text: `Tres salones tienen ${near[0]}, ${near[1]} y ${near[2]} alumnos. Si redondeas cada número a la decena más cercana, ¿cuántos alumnos hay aproximadamente?`,
      expectedAnswer: tens.reduce((sum, t) => sum + t * 10, 0),
    }
  },
})

export const BANK_SKILLS = Object.freeze(Object.keys(BUILDERS))

/**
 * @param {{ skillIds?: string[]|null, seed: string }} input
 * @returns {{ activityId: string, skillId: string, text: string, expectedAnswer: number }}
 */
export function pickProblem({ skillIds = null, seed }) {
  const usable = (Array.isArray(skillIds) ? skillIds : []).filter((id) => BANK_SKILLS.includes(id))
  const skillId = usable.length > 0 ? usable[Math.floor(seededUnit(`${seed}:skill`) * usable.length)] : FALLBACK_SKILL
  const { text, expectedAnswer } = BUILDERS[skillId](seed)
  return { activityId: `auto-${skillId}`, skillId, text, expectedAnswer }
}
