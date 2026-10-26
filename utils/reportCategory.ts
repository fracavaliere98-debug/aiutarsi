/**
 * La tabella `reports` non ha una colonna categoria: ReportModal e la segnalazione dei post
 * salvano il motivo come "<Categoria>: <testo>". Questa funzione ricava la categoria da lì.
 */
export function getReportCategory(report: { reason?: string | null; report_category?: string | null }): string {
  if (report.report_category) return report.report_category.toUpperCase();
  const reason = report.reason ?? '';
  const idx = reason.indexOf(':');
  if (idx > 0 && idx <= 40) return reason.slice(0, idx).trim().toUpperCase();
  return 'ALTRO';
}

export function describeReportTarget(contentType?: string | null): string {
  switch (contentType) {
    case 'community_post': return 'Post della community';
    case 'message': return 'Messaggio in chat';
    case 'profile': return 'Profilo';
    default: return 'Contenuto';
  }
}

/**
 * A40: titolo della notifica che l'admin manda a chi ha segnalato quando decide.
 * Lo usano sia app/admin/report/[id].tsx (invio) sia hooks/notifications/routeResolver.ts (tocco -> /my-reports):
 * la notifica non porta l'id della segnalazione, e il tocco da push non riceve il payload.
 */
export const REPORT_UPDATE_NOTIFICATION_TITLE = 'Aggiornamento Segnalazione';

/** A40: esito mostrato a chi ha segnalato (mai la sanzione esatta, vedi get_my_reports). */
export type MyReportOutcome = 'pending' | 'action_taken' | 'no_violation';
