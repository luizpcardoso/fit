import { useEffect, useRef } from 'react';
import { showDialog } from '@/components/app-dialog';

/**
 * Declarative wrapper around the shared dialog for screens that keep the confirmation in state.
 * Rejections from onConfirm keep the dialog open with a retry message.
 */
export function ConfirmDialog({ title, message, confirmLabel = 'Excluir', destructive = true, onCancel, onConfirm }: { title: string; message: string; confirmLabel?: string; destructive?: boolean; onCancel(): void; onConfirm(): Promise<void> }) {
  const handlers = useRef({ onCancel, onConfirm });
  useEffect(() => { handlers.current = { onCancel, onConfirm }; });
  useEffect(() => showDialog(title, message, [
    { text: 'Cancelar', style: 'cancel', onPress: () => handlers.current.onCancel() },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => handlers.current.onConfirm() },
  ]), [title, message, confirmLabel, destructive]);
  return null;
}
