/**
 * Contexto de notificaciones (interno de Toast).
 *
 * Vive en su propio archivo para no mezclar constantes con componentes y
 * mantener válida la regla de Fast Refresh.
 */
import { createContext } from 'react'

/** @type {import('react').Context<null | {success: Function, error: Function, warning: Function, info: Function, dismiss: Function}>} */
export const ToastContext = createContext(null)