import { backendFetch } from "@/lib/backend-api";

export function fetchCurrentSession() {
  return backendFetch("auth/session");
}
