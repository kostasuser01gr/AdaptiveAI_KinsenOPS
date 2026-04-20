import React, { lazy, Suspense } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Loader2 } from "lucide-react";
import { ChatSkeleton, TableSkeleton, AnalyticsSkeleton, SettingsSkeleton, KanbanSkeleton, DashboardSkeleton } from "@/components/skeletons/PageSkeletons";

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
const ChannelsPage = lazy(() => import("@/pages/Channels"));
const AppBuilderPage = lazy(() => import("@/pages/AppBuilder"));
const WasherLayout = lazy(() => import("@/pages/washer/WasherLayout"));
const WasherRegister = lazy(() => import("@/pages/washer/WasherRegister"));
const WasherChat = lazy(() => import("@/pages/washer/WasherChat"));
const CustomerEntry = lazy(() => import("@/pages/customer/CustomerEntry"));
const CustomerLayout = lazy(() => import("@/pages/customer/CustomerLayout"));
const CustomerUpload = lazy(() => import("@/pages/customer/CustomerUpload"));
const CustomerChat = lazy(() => import("@/pages/customer/CustomerChat"));
const SetupWizard = lazy(() => import("@/pages/SetupWizard"));
const DashboardPage = lazy(() => import("@/pages/Dashboard"));
const GodMode = lazy(() => import("@/pages/GodMode"));
const SystemConfigurationPage = lazy(() => import("@/pages/SystemConfiguration"));
const WorkspacePage = lazy(() => import("@/pages/Workspace"));
const IdeasHubPage = lazy(() => import("@/pages/IdeasHub"));

import { AppProvider } from "@/lib/AppContext";
import { useAuth } from "@/lib/useAuth";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import { useWebSocket } from "@/hooks/useWebSocket";
import { InstallPrompt, PWAProvider } from "@/components/pwa/InstallPrompt";
import { AnimatedPage, AnimatePresence } from "@/lib/animations";
import { isRoleAtLeast } from "../../shared/roles";
import { Sentry, setSentryUser } from "@/lib/sentry";

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
  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
    Sentry.withScope((scope) => {
      scope.setContext("react", { componentStack: info.componentStack });
      scope.setTag("boundary", "app-react");
      Sentry.captureException(error);
    });
    fetch("/api/client-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        componentStack: info.componentStack,
        url: window.location.href,
        userAgent: navigator.userAgent,
      }),
    }).catch(() => {});
  }
  override render() {
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

// ─── Sentry user sync ─────────────────────────────────────────────────────────
function SentryUserSync() {
  const { user } = useAuth();
  React.useEffect(() => {
    if (user) {
      setSentryUser({
        id: user.id,
        username: user.username,
        role: user.role,
        workspaceId: user.workspaceId,
      });
    } else {
      setSentryUser(null);
    }
  }, [user]);
  return null;
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

function StaffRoute({ children, skeleton }: { children: React.ReactNode; skeleton?: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  useWebSocket(user ? WS_CHANNELS : []);
  if (isLoading) return <FullScreenLoader />;
  if (!user) return <AuthPage />;
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <MainLayout>
        <ErrorBoundary>
          <Suspense fallback={skeleton ?? <PageSkeleton />}>
            <AnimatePresence mode="wait">
              <AnimatedPage key={location}>
                {children}
              </AnimatedPage>
            </AnimatePresence>
          </Suspense>
        </ErrorBoundary>
      </MainLayout>
    </Suspense>
  );
}

function AdminRoute({ children, skeleton }: { children: React.ReactNode; skeleton?: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  useWebSocket(user ? WS_CHANNELS : []);
  if (isLoading) return <FullScreenLoader />;
  if (!user) return <AuthPage />;
  if (!isRoleAtLeast(user.role, 'admin')) {
    return (
      <Suspense fallback={<FullScreenLoader />}>
        <MainLayout>
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center min-h-[300px]">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="font-semibold text-lg">Access Denied</p>
            <p className="text-sm text-muted-foreground">This page is restricted to administrators.</p>
          </div>
        </MainLayout>
      </Suspense>
    );
  }
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <MainLayout>
        <ErrorBoundary>
          <Suspense fallback={skeleton ?? <PageSkeleton />}>
            <AnimatePresence mode="wait">
              <AnimatedPage key={location}>
                {children}
              </AnimatedPage>
            </AnimatePresence>
          </Suspense>
        </ErrorBoundary>
      </MainLayout>
    </Suspense>
  );
}

function SetupGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <FullScreenLoader />;
  // If user is already logged in, redirect to home
  if (user) {
    window.location.replace('/');
    return <FullScreenLoader />;
  }
  return <>{children}</>;
}

// ─── Scroll to top on route change ───────────────────────────────────────────
function ScrollToTop() {
  const [location] = useLocation();
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function Router() {
  return (
    <>
    <ScrollToTop />
    <Switch>
      <Route path="/setup">
        <SetupGuard><ErrorBoundary><Suspense fallback={<FullScreenLoader />}><SetupWizard /></Suspense></ErrorBoundary></SetupGuard>
      </Route>
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

      <Route path="/dashboard"><StaffRoute skeleton={<DashboardSkeleton />}><DashboardPage /></StaffRoute></Route>
      <Route path="/fleet"><StaffRoute skeleton={<TableSkeleton />}><FleetPage /></StaffRoute></Route>
      <Route path="/washers"><StaffRoute skeleton={<KanbanSkeleton />}><WashersPage /></StaffRoute></Route>
      <Route path="/shifts"><StaffRoute skeleton={<TableSkeleton />}><ShiftsPage /></StaffRoute></Route>
      <Route path="/calendar"><StaffRoute skeleton={<DashboardSkeleton />}><CalendarPage /></StaffRoute></Route>
      <Route path="/imports"><StaffRoute skeleton={<TableSkeleton />}><ImportsPage /></StaffRoute></Route>
      <Route path="/inbox"><StaffRoute skeleton={<TableSkeleton />}><OpsInboxPage /></StaffRoute></Route>
      <Route path="/analytics"><StaffRoute skeleton={<AnalyticsSkeleton />}><AnalyticsPage /></StaffRoute></Route>
      <Route path="/digital-twin"><StaffRoute skeleton={<DashboardSkeleton />}><DigitalTwinPage /></StaffRoute></Route>
      <Route path="/automations"><StaffRoute skeleton={<TableSkeleton />}><AutomationsPage /></StaffRoute></Route>
      <Route path="/war-room"><StaffRoute skeleton={<DashboardSkeleton />}><WarRoomPage /></StaffRoute></Route>
      <Route path="/executive"><StaffRoute skeleton={<AnalyticsSkeleton />}><ExecutiveIntelligencePage /></StaffRoute></Route>
      <Route path="/vehicle-intelligence"><StaffRoute skeleton={<DashboardSkeleton />}><VehicleIntelligencePage /></StaffRoute></Route>
      <Route path="/workspace-memory"><StaffRoute skeleton={<TableSkeleton />}><WorkspaceMemoryPage /></StaffRoute></Route>
      <Route path="/trust"><StaffRoute skeleton={<DashboardSkeleton />}><TrustConsolePage /></StaffRoute></Route>
      <Route path="/proposals"><StaffRoute skeleton={<TableSkeleton />}><ProposalsPage /></StaffRoute></Route>
      <Route path="/channels"><StaffRoute skeleton={<ChatSkeleton />}><ChannelsPage /></StaffRoute></Route>
      <Route path="/app-builder"><StaffRoute skeleton={<DashboardSkeleton />}><AppBuilderPage /></StaffRoute></Route>
      <Route path="/workspace"><StaffRoute skeleton={<DashboardSkeleton />}><WorkspacePage /></StaffRoute></Route>
      <Route path="/ideas"><StaffRoute skeleton={<TableSkeleton />}><IdeasHubPage /></StaffRoute></Route>
      <Route path="/god-mode"><AdminRoute skeleton={<DashboardSkeleton />}><GodMode /></AdminRoute></Route>
      <Route path="/system-config"><AdminRoute skeleton={<SettingsSkeleton />}><SystemConfigurationPage /></AdminRoute></Route>
      <Route path="/settings"><StaffRoute skeleton={<SettingsSkeleton />}><SettingsPage /></StaffRoute></Route>
      <Route path="/shortcuts"><StaffRoute skeleton={<DashboardSkeleton />}><ShortcutsPage /></StaffRoute></Route>
      <Route path="/knowledge"><StaffRoute skeleton={<TableSkeleton />}><KnowledgeBasePage /></StaffRoute></Route>
      <Route path="/knowledge-base"><StaffRoute skeleton={<TableSkeleton />}><KnowledgeBasePage /></StaffRoute></Route>
      <Route path="/users"><StaffRoute skeleton={<TableSkeleton />}><UsersPage /></StaffRoute></Route>
      <Route path="/chat/:id"><StaffRoute skeleton={<ChatSkeleton />}><ChatPage /></StaffRoute></Route>
      <Route path="/"><StaffRoute skeleton={<ChatSkeleton />}><ChatPage /></StaffRoute></Route>

      <Route component={NotFound} />
    </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <PWAProvider>
          <TooltipProvider delayDuration={200}>
            <SentryUserSync />
            <ConnectionBanner />
            <ErrorBoundary>
              <Router />
            </ErrorBoundary>
            <InstallPrompt />
            <Toaster />
          </TooltipProvider>
        </PWAProvider>
      </AppProvider>
    </QueryClientProvider>
  );
}

export default App;
