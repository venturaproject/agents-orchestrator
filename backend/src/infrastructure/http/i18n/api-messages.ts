import type { Locale } from "../../../application/shared/locale";

export type ApiMessageKey =
  | "invalidRequest"
  | "loginInvalidCredentials"
  | "loginFailed"
  | "loginRequired"
  | "runsLoadFailed"
  | "runInvalid"
  | "runSaveFailed"
  | "patchLoginRequired"
  | "patchMissing"
  | "agentLoginRequired"
  | "agentRunMissing"
  | "agentUnavailable"
  | "agentFailed";

const messages: Record<Locale, Record<ApiMessageKey, string>> = {
  en: {
    invalidRequest: "Invalid request.",
    loginInvalidCredentials: "Email or password is incorrect.",
    loginFailed: "Could not sign in.",
    loginRequired: "Sign in to continue.",
    runsLoadFailed: "Could not load runs.",
    runInvalid: "Invalid run.",
    runSaveFailed: "Could not save the run.",
    patchLoginRequired: "Sign in to download this patch.",
    patchMissing: "This run does not contain a patch.",
    agentLoginRequired: "Sign in to run agents.",
    agentRunMissing: "Run not found.",
    agentUnavailable: "Configure GROQ_API_KEY or NVIDIA_API_KEY on the server.",
    agentFailed: "Could not complete the agent run.",
  },
  es: {
    invalidRequest: "Solicitud no válida.",
    loginInvalidCredentials: "El correo o la contraseña son incorrectos.",
    loginFailed: "No se pudo iniciar sesión.",
    loginRequired: "Inicia sesión para continuar.",
    runsLoadFailed: "No se pudieron cargar las ejecuciones.",
    runInvalid: "Ejecución no válida.",
    runSaveFailed: "No se pudo guardar la ejecución.",
    patchLoginRequired: "Inicia sesión para descargar este parche.",
    patchMissing: "Esta ejecución no contiene un parche.",
    agentLoginRequired: "Inicia sesión para ejecutar los agentes.",
    agentRunMissing: "No se encontró esta ejecución.",
    agentUnavailable: "Configura GROQ_API_KEY o NVIDIA_API_KEY en el servidor.",
    agentFailed: "No se pudo completar la ejecución de agentes.",
  },
};

export function apiMessage(locale: Locale, key: ApiMessageKey): string {
  return messages[locale][key];
}

export function apiError(locale: Locale, key: ApiMessageKey) {
  return { code: key, error: apiMessage(locale, key) };
}
