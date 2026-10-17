/**
 * Datos simulados de la vista previa del design system.
 *
 * TODO es ficticio y local: sin Firebase, sin `AuthContext`, sin red. Sirve
 * únicamente para renderizar ejemplos deterministas.
 */

export const paletteSamples = [
  { name: 'Verde bosque', token: 'forest', hex: '#304744', usage: 'Sidebar, texto fuerte, superficies oscuras' },
  { name: 'Verde principal', token: 'brand', hex: '#4CDB59', usage: 'Acción primaria, acentos, ruta activa' },
  { name: 'Verde menta', token: 'mint', hex: '#E9F8EA', usage: 'Fondos suaves, badges y estados positivos' },
  { name: 'Fondo principal', token: 'canvas', hex: '#F8FAF6', usage: 'Fondo de página' },
  { name: 'Blanco', token: 'white', hex: '#FFFFFF', usage: 'Tarjetas y superficies' },
  { name: 'Texto principal', token: 'ink', hex: '#263D48', usage: 'Texto de máxima legibilidad' },
  { name: 'Gris natural', token: 'stone', hex: '#ABB1AB', usage: 'Bordes, metadatos, deshabilitado' },
]

export const students = [
  { name: 'Ana Torres', skill: 'Álgebra', level: 'Avanzado', match: 0.92 },
  { name: 'Luis Ramírez', skill: 'Geometría', level: 'Intermedio', match: 0.87 },
  { name: 'Sofía Herrera', skill: 'Cálculo', level: 'Inicial', match: 0.78 },
  { name: 'Mateo Ríos', skill: 'Física', level: 'Avanzado', match: 0.74 },
  { name: 'Valeria Ortiz', skill: 'Estadística', level: 'Intermedio', match: 0.69 },
]

export const sessions = [
  { title: 'Ecuaciones de segundo grado', date: 'Hoy · 15:00', status: 'scheduled' },
  { title: 'Funciones y dominios', date: 'Ayer · 17:30', status: 'completed' },
  { title: 'Teorema de Pitágoras', date: '12 oct · 16:00', status: 'completed' },
  { title: 'Probabilidad básica', date: '10 oct · 18:00', status: 'cancelled' },
]

export const competenceLevels = [
  { label: 'Números', value: 0.85 },
  { label: 'Álgebra', value: 0.6 },
  { label: 'Geometría', value: 0.42 },
  { label: 'Cálculo', value: 0.18 },
]

export const competencies = [
  { name: 'Ana Torres', role: 'Tutora', complement: 92, tone: 'brand' },
  { name: 'Luis Ramírez', role: 'Aprendiz', complement: 87, tone: 'brand' },
  { name: 'Sofía Herrera', role: 'Tutora', complement: 78, tone: 'info' },
]

export const formValues = {
  fullName: 'Ana Torres',
  email: 'ana.torres@koeduko.dev',
  grade: '9',
  topic: 'Ecuaciones de segundo grado',
  password: 'koeduko2026',
}

export const selectOptions = [
  { value: '', label: 'Selecciona un grado…', disabled: true },
  { value: '7', label: 'Séptimo' },
  { value: '8', label: 'Octavo' },
  { value: '9', label: 'Noveno' },
  { value: '10', label: 'Décimo' },
  { value: '11', label: 'Once' },
]

export const icons = [
  'home', 'users', 'chart', 'sparkles', 'clipboard', 'calendar', 'settings', 'logout',
  'plus', 'check', 'close', 'menu', 'search', 'edit', 'trash', 'filter', 'download',
  'refresh', 'link', 'external', 'chevronDown', 'chevronUp', 'chevronRight', 'chevronLeft',
  'arrowRight', 'info', 'alert', 'clock', 'video', 'sparkle', 'book', 'bell', 'eye',
  'eyeOff', 'koala',
]