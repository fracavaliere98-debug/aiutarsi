/**
 * Race a promise against a timeout, rejecting with a clear error instead of hanging forever.
 * Usato per chiamate di rete (upload, richieste HTTP) dove un problema di rete silenzioso
 * lascerebbe altrimenti l'operazione bloccata a tempo indefinito senza errore visibile.
 */
export async function withTimeout<T>(promise: PromiseLike<T>, label: string, timeoutMs = 20000): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs);
            }),
        ]);
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}
