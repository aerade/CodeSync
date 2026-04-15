import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, useClerk, useUser, useAuth } from "@clerk/react";
import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "./pages/home";
import Dashboard from "./pages/dashboard";
import RoomPage from "./pages/room";
import { setGuestTokenGetter, setAuthTokenGetter } from "@workspace/api-client-react";

// Initialize guest token getter so all API calls include x-guest-token when present
setGuestTokenGetter(() => localStorage.getItem("codesync_guest_token"));

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY environment variable");
}

const clerkAppearance = {
  variables: {
    colorBackground: "#1C2128",
    colorText: "#E6EDF3",
    colorPrimary: "#58A6FF",
    colorInputBackground: "#0D1117",
    colorInputText: "#E6EDF3",
  },
};

function SignInPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "#161B22" }}
    >
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={`${basePath}/dashboard`}
        appearance={clerkAppearance}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "#161B22" }}
    >
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        fallbackRedirectUrl={`${basePath}/dashboard`}
        appearance={clerkAppearance}
      />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const { isLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  // Wire up Bearer token getter so all API calls include Clerk JWT after sign-in.
  // This ensures private rooms and authenticated endpoints work cross-origin.
  useEffect(() => {
    setAuthTokenGetter(isSignedIn ? () => getToken() : null);
    return () => setAuthTokenGetter(null);
  }, [isSignedIn, getToken]);

  // Eagerly clear stale guest tokens as soon as Clerk confirms a signed-in user.
  // This covers page refreshes and OAuth redirects (Gmail etc.) where the listener
  // may fire after a brief delay, causing the app to show guest-mode UI temporarily.
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      localStorage.removeItem("codesync_guest_token");
      localStorage.removeItem("codesync_guest_user_id");
      localStorage.removeItem("codesync_guest_username");
      // Force a full refetch so private rooms appear immediately
      qc.invalidateQueries();
    }
  }, [isLoaded, isSignedIn, qc]);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        qc.clear();
      }

      // Clear guest credentials when a Clerk user signs in so the guest token
      // is never sent alongside a valid Clerk session (avoids identity precedence bugs)
      if (userId) {
        localStorage.removeItem("codesync_guest_token");
        localStorage.removeItem("codesync_guest_user_id");
        localStorage.removeItem("codesync_guest_username");
      }

      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      {...(clerkProxyUrl ? { proxyUrl: clerkProxyUrl } : {})}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
      signInFallbackRedirectUrl={`${basePath}/dashboard`}
      signUpFallbackRedirectUrl={`${basePath}/dashboard`}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/room/:roomId" component={RoomPage} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
