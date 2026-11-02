import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type ToastVariant = 'success' | 'error' | 'info';
export type ToastTone = ToastVariant | 'danger' | 'warn';

export interface Toast {
  id: number;
  variant: ToastVariant;
  title?: string;
  message: string;
}

/** Toasts can be raised with a plain string or with a structured payload. */
export interface NotifyOptions {
  title?: string;
  message: string;
  tone?: ToastTone;
  variant?: ToastVariant;
}

export type NotifyInput = string | NotifyOptions;

interface ToastValue {
  toasts: Toast[];
  notify: (input: NotifyInput, variant?: Toast.Variant) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, variant: ToastVariant = 'success') => {
      const id = nextId.current;
      nextId.current += 1;
      setToasts((current) => [...current.slice(-3), { id, variant, message }]);
      window.setTimeout(() => dismiss(id), variant === 'error' ? 7000 : 4500);
    },
    [dismiss],
  );

  const value = useMemo<ToastValue>(() => ({ toasts, notify, dismiss }), [toasts, notify, dismiss]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
