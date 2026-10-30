// Etiquetas en español y colores para los estados de un pedido.
export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  PAID: 'Confirmado',
  SHIPPED: 'Enviado',
  COMPLETED: 'Completado',
  CANCELED: 'Cancelado'
};

export const ORDER_STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  PAID: 'bg-blue-100 text-blue-800',
  SHIPPED: 'bg-indigo-100 text-indigo-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELED: 'bg-red-100 text-red-700'
};

export function orderStatusLabel(status: string) {
  return ORDER_STATUS_LABELS[status] || status;
}
