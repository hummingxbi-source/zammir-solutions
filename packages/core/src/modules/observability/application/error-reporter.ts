import { buildErrorReport, fingerprintOf, type ErrorReport } from '../domain/error-report';

export interface ErrorReporterDeps {
  /** Entrega un reporte ya limpio al registro. Puede fallar: nunca debe romper la aplicación. */
  readonly send: (reporte: ErrorReport) => Promise<void>;
  readonly source: 'CLIENT' | 'SERVER';
  readonly appVersion: string;
  /** Tope de reportes distintos por sesión; evita inundar el registro si algo falla en ciclo. */
  readonly maxReports?: number;
}

export interface ErrorReporter {
  /** Registra un error sin datos personales. Devuelve si lo envió (`false` si era repetido o se pasó del tope). */
  report(error: unknown, ruta?: string): Promise<boolean>;
}

export const DEFAULT_MAX_REPORTS = 10;

/** Reportero de errores: limpia, quita repetidos, respeta un tope y nunca lanza [RNF-34, S4-28]. */
export function createErrorReporter(deps: ErrorReporterDeps): ErrorReporter {
  const vistos = new Set<string>();
  const tope = deps.maxReports ?? DEFAULT_MAX_REPORTS;
  return {
    async report(error, ruta) {
      try {
        const reporte = buildErrorReport({
          source: deps.source,
          error,
          route: ruta,
          appVersion: deps.appVersion,
        });
        const huella = fingerprintOf(reporte);
        if (vistos.has(huella) || vistos.size >= tope) {
          return false;
        }
        vistos.add(huella);
        await deps.send(reporte);
        return true;
      } catch {
        return false;
      }
    },
  };
}
