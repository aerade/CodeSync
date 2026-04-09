export * from "./generated/api";
export * from "./generated/api.schemas";
export {
  setBaseUrl,
  setAuthTokenGetter,
  setGuestTokenGetter,
} from "./custom-fetch";
export type { AuthTokenGetter } from "./custom-fetch";
