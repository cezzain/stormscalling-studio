import { createContext, useContext } from 'react';

/** Shared auth state for the running app (provided by AuthGate). */
export interface SessionInfo {
  /** True when a login wall is active (i.e. credentials configured on the host). */
  authRequired: boolean;
  /** End the session and return to the login screen. */
  logout: () => void;
}

export const SessionContext = createContext<SessionInfo>({
  authRequired: false,
  logout: () => {},
});

export const useSession = () => useContext(SessionContext);
