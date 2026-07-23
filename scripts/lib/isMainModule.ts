import { fileURLToPath } from "node:url";

/**
 * `import.meta.main` non esiste su Node 20 (arriva solo da Node 22.12+/24, e questo
 * progetto usa Node 20 sia in CI che in locale): torna sempre `undefined`, quindi
 * `if (import.meta.main)` è sempre falso e lo script non esegue mai nulla, pur
 * uscendo con successo (exit 0) — verificato che questo lasciava tutti gli smoke
 * test su staging silenziosamente no-op. Confronto affidabile su tutte le versioni:
 * il path dello script invocato (argv[1]) contro il path del modulo corrente.
 */
export function isMainModule(importMetaUrl: string): boolean {
    return !!process.argv[1] && fileURLToPath(importMetaUrl) === process.argv[1];
}
