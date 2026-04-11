import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";

export function useCurrentUser() {
  const { isAuthenticated: sessionAuth, isLoading: authLoading } = useAuth();

  const guestToken = typeof window !== "undefined" ? localStorage.getItem("codesync_guest_token") : null;
  const guestUsername = typeof window !== "undefined" ? localStorage.getItem("codesync_guest_username") : null;

  const isGuest = !authLoading && !sessionAuth && !!guestToken;
  const isSignedIn = !authLoading && sessionAuth;
  const isAuthenticated = isSignedIn || isGuest;

  const { data: me, isLoading: meLoading } = useGetMe({
    query: { enabled: !authLoading, queryKey: getGetMeQueryKey() },
  });

  return {
    user: me,
    isLoading: authLoading || meLoading,
    isSignedIn,
    isGuest,
    isAuthenticated,
    guestToken,
    guestUsername,
  };
}
