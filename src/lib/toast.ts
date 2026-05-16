type ToastType = 'error' | 'success' | 'warning';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
let nextId = 0;
const listeners: Set<Listener> = new Set();

function notify() {
  listeners.forEach((fn) => fn([...toasts]));
}

export function showToast(type: ToastType, message: string, durationMs = 5000) {
  const id = nextId++;
  toasts = [...toasts, { id, type, message }];
  notify();
  setTimeout(() => {
    dismissToast(id);
  }, durationMs);
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToasts(): Toast[] {
  return toasts;
}
