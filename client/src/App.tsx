import React, { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Loader2 } from "lucide-react";

// Static imports for tiny always-needed pages
import AuthPage from "@/pages/Auth";
import NotFound from "@/pages/not-found";

// Lazy-load all heavy pages — reduces initial bundle by ~80%
const MainLayout = lazy(() => import("@/components/layout/MainLayout"));
const ChatPage = lazy(() => import("@/pages/Chat"));
const SettingsPage = lazy(() => import("@/pages/Settings"));
const ShortcutsPage = lazy(() => import("@/pages/Shortcuts"));
const KnowledgeBasePage = lazy(() => import("@/pages/KnowledgeBase"));
const UsersPage = lazy(() => import("@/pages/Users"));
const FleetPage = lazy(() => import("@/pages/Fleet"));
const WashersPage = lazy(() => import("@/pages/Washers"));
const ShiftsPage = lazy(() => import("@/pages/Shifts"));
const CalendarPage = lazy(() => import("@/pages/Calendar"));
const ImportsPage = lazy(() => import("@/pages/Imports"));
const OpsInboxPage = lazy(() => import("@/pages/OpsInbox"));
const AnalyticsPage = lazy(() => import("@/pages/Analytics"));
const DigitalTwinPage = lazy(() => import("@/pages/DigitalTwin"));
const AutomationsPage = lazy(() => import("@/pages/Automations"));
const WarRoomPage = lazy(() => import("@/pages/WarRoom"));
const ExecutiveIntelligencePage = lazy(() => import("@/pages/ExecutiveIntelligence"));
const VehicleIntelligencePage = lazy(() => import("@/pages/VehicleIntelligence"));
const WorkspaceMemoryPage = lazy(() => import("@/pages/WorkspaceMemory"));
const TrustConsolePage = lazy(() => import("@/pages/TrustConsole"));
const ProposalsPage = lazy(() => import("@/pages/Proposals"));
const WasherLayout = lazy(() => import("@/pages/washer/WasherLayout"));
const WasherRegister = lazy(() => import("@/pages/washer/WasherRegister"));
const WasherChat = lazy(() => import("@/pages/washer/WasherChat"));
const CustomerEntry = lazy(() => import("@/pages/customer/CustomerEntry"));
const CustomerLayout = lazy(() => import("@/pages/customer/CustomerLayout"));
const CustomerUpload = lazy(() => import("@/pages/customer/CustomerUpload"));
const CustomerChat = lazy(() => import("@/pages/customer/CustomerChat"));

import { AppProvider } from "@/lib/AppContext";
import { useAuth } from "@/lib/useAuth";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import { useWebSocket } from "@/hooks/useWebSocket";

// ─── Error Boundary ──────────────────────────────────────────────────────────
interface EBState { hasError: boolean; error?: Error }

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, EBState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center min-h-[200px]">
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <p className="font-semibold">Something went wrong</p>
            <p className="text-sm text-muted-foreground mt-1">
              {this.state.error?.message ?? "An unexpected error occurred."}
            </p>
          </div>
          <button
            className="text-sm text-primary underline"
            onClick={() => { this.setState({ hasError: false }); }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Loading skeletons ────────────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-6 h-full">
      <Skeleton className="h-10 w-48" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

function FullScreenLoader() {
  return (
    <div className="flex items-center justify-center h-[100dvh] bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

// ─── Auth wrapper ─────────────────────────────────────────────────────────────
const WS_CHANNELS = ['vehicles', 'wash-queue', 'activity', 'notifications'];

function StaffRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  useWebSocket(user ? WS_CHANNELS : []);
  if (isLoading) return <FullScreenLoader />;
  if (!user) return <AuthPage />;
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <MainLayout>
        <ErrorBoundary>
          <Suspense fallback={<PageSkeleton />}>
            {children}
          </Suspense>
        </ErrorBoundary>
      </MainLayout>
    </Suspense>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/customer">
        <ErrorBoundary><Suspense fallback={<FullScreenLoader />}><CustomerEntry /></Suspense></ErrorBoundary>
      </Route>
      <Route path="/customer/res/:id/:tab">
        {(params) => (
          <ErrorBoundary>
            <Suspense fallback={<FullScreenLoader />}>
              <CustomerLayout params={params}>
                {params.tab === 'upload' ? <CustomerUpload /> : <CustomerChat />}
              </CustomerLayout>
            </Suspense>
          </ErrorBoundary>
        )}
      </Route>

      <Route path="/washer/:tab">
        {(params) => (
          <ErrorBoundary>
            <Suspense fallback={<FullScreenLoader />}>
              <WasherLayout>
                {params.tab === 'register' ? <WasherRegister /> : <WasherChat />}
              </WasherLayout>
            </Suspense>
          </ErrorBoundary>
        )}
      </Route>
      <Route path="/washer">
        <ErrorBoundary>
          <Suspense fallback={<FullScreenLoader />}>
            <WasherLayout><WasherRegister /></WasherLayout>
          </Suspense>
        </ErrorBoundary>
      </Route>

      <Route path="/fleet"><StaffRoute><FleetPage /></StaffRoute></Route>
      <Route path="/washers"><StaffRoute><WashersPage /></StaffRoute></Route>
      <Route path="/shifts"><StaffRoute><ShiftsPage /></StaffRoute></Route>
      <Route path="/calendar"><StaffRoute><CalendarPage /></StaffRoute></Route>
      <Route path="/imports"><StaffRoute><ImportsPage /></StaffRoute></Route>
      <Route path="/inbox"><StaffRoute><OpsInboxPage /></StaffRoute></Route>
      <Route path="/analytics"><StaffRoute><AnalyticsPage /></StaffRoute></Route>
      <Route path="/digital-twin"><StaffRoute><DigitalTwinPage /></StaffRoute></Route>
      <Route path="/automations"><StaffRoute><AutomationsPage /></StaffRoute></Route>
      <Route path="/war-room"><StaffRoute><WarRoomPage /></StaffRoute></Route>
      <Route path="/executive"><StaffRoute><ExecutiveIntelligencePage /></StaffRoute></Route>
      <Route path="/vehicle-intelligence"><StaffRoute><VehicleIntelligencePage /></StaffRoute></Route>
      <Route path="/workspace-memory"><StaffRoute><WorkspaceMemoryPage /></StaffRoute></Route>
      <Route path="/trust"><StaffRoute><TrustConsolePage /></StaffRoute></Route>
      <Route path="/proposals"><StaffRoute><ProposalsPage /></StaffRoute></Route>
      <Route path="/settings"><StaffRoute><SettingsPage /></StaffRoute></Route>
      <Route path="/shortcuts"><StaffRoute><ShortcutsPage /></StaffRoute></Route>
      <Route path="/knowledge"><StaffRoute><KnowledgeBasePage /></StaffRoute></Route>
      <Route path="/knowledge-base"><StaffRoute><KnowledgeBasePage /></StaffRoute></Route>
      <Route path="/users"><StaffRoute><UsersPage /></StaffRoute></Route>
      <Route path="/chat/:id"><StaffRoute><ChatPage /></StaffRoute></Route>
      <Route path="/"><StaffRoute><ChatPage /></StaffRoute></Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <TooltipProvider delayDuration={200}>
          <ConnectionBanner />
          <ErrorBoundary>
            <Router />
          </ErrorBoundary>
          <Toaster />
        </TooltipProvider>
      </AppProvider>
    </QueryClientProvider>
  );
}

export default App;
