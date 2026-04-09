import { useGetMe } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";

export function useCurrentUser() {
  const { isSignedIn, user: clerkUser, isLoaded } = useUser();
  const { data: me, isLoading } = useGetMe({
    query: { enabled: isLoaded },
  });

  const guestToken = typeof window !== "undefined" ? localStorage.getItem("codesync_guest_token") : null;
  const guestUsername = typeof window !== "undefined" ? localStorage.getItem("codesync_guest_username") : null;

  const isGuest = !isSignedIn && !!guestToken;
  const isAuthenticated = !!isSignedIn || isGuest;

  return {
    user: me,
    isLoading: !isLoaded || isLoading,
    isSignedIn,
    isGuest,
    isAuthenticated,
    guestToken,
    guestUsername,
    clerkUser,
  };
}
