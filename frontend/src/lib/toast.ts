import { createContext, useContext } from 'react'

export type ToastKind = 'success' | 'error'
export type Notify = (message: string, kind?: ToastKind) => void

export const ToastContext = createContext<Notify>(() => {})

export function useToast(): Notify {
  return useContext(ToastContext)
}
