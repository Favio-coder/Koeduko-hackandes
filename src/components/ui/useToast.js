/**
 * useToast — acceso a las notificaciones de KoEduko.
 *
 * @returns {{success: Function, error: Function, warning: Function, info: Function, dismiss: Function}}
 *
 * @example
 * const toast = useToast()
 * await toast.success('Sesión guardada.')
 * toast.error('No se pudo sincronizar.')
 */
import { useContext } from 'react'
import { ToastContext } from './toastContext'

const noop = { success: () => {}, error: () => {}, warning: () => {}, info: () => {}, dismiss: () => {} }

export default function useToast() {
  return useContext(ToastContext) ?? noop
}