export function getAuthParamsFromLocation() {
  const search = new URLSearchParams(window.location.search);
  const hash = window.location.hash.startsWith("#")
    ? new URLSearchParams(window.location.hash.slice(1))
    : new URLSearchParams(window.location.hash);

  return {
    code: search.get("code") || hash.get("code"),
    tokenHash: search.get("token_hash") || hash.get("token_hash"),
    type: search.get("type") || hash.get("type"),
    error: search.get("error") || hash.get("error"),
    errorCode: search.get("error_code") || hash.get("error_code"),
    errorDescription: search.get("error_description") || hash.get("error_description"),
  };
}

export function humanizeAuthError(errorCode?: string | null, errorDescription?: string | null) {
  const normalizedCode = (errorCode || "").toLowerCase();
  const normalizedDescription = (errorDescription || "").replace(/\+/g, " ");

  if (normalizedCode === "otp_expired") {
    return "Questo link non è più valido o è già stato usato. Richiedi una nuova email e riprova.";
  }

  if (normalizedCode === "access_denied") {
    return "Il link non è valido oppure non può più essere utilizzato.";
  }

  return normalizedDescription || "Il link non è valido oppure è scaduto.";
}
