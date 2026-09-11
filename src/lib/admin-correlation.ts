export const ADMIN_CORRELATION_ID_HEADER = 'x-admin-correlation-id'

export function getAdminCorrelationHeaders(correlationId?: string | null): Record<string, string> {
  return correlationId
    ? { [ADMIN_CORRELATION_ID_HEADER]: correlationId }
    : {}
}
