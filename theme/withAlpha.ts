// Helper condiviso per derivare una variante "rgba(...)" trasparente di un colore token
// esistente (es. withAlpha(colors.primary, 0.08)) senza introdurre una nuova palette.
// Nato in app/index.tsx (landing page) e poi riusato in app/(volunteer)/(tabs)/search.tsx:
// spostato qui per evitare una terza copia duplicata della stessa funzione pura.
export function withAlpha(hex: string, alpha: number): string {
    const clean = hex.replace("#", "");
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
