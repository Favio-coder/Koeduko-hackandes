/**
 * Tamaños esperados para N estudiantes según el contrato:
 * par → todas parejas; impar → exactamente un trío + resto parejas.
 * @param {number} count número de estudiantes.
 * @returns {number[]} tamaños de grupo ordenados de menor a mayor.
 */
export default function expectedGroupSizes(count) {
  if (count < 2) return []
  const sizes = count % 2
    ? [3, ...Array((count - 3) / 2).fill(2)]
    : Array(count / 2).fill(2)
  return sizes.sort((a, b) => a - b)
}
