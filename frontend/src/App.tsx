import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { Loader2 } from "lucide-react";
import { getErrorMessage, logError } from "@/utils/errorHandler";
import { toast } from "sonner";
import { QueryCache, MutationCache } from "@tanstack/react-query";

// Lazy load pages for code splitting
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Companies = lazy(() => import("./pages/Companies"));
const Inward = lazy(() => import("./pages/Inward"));
const Outward = lazy(() => import("./pages/Outward"));
const Transporters = lazy(() => import("./pages/Transporters"));
const Invoices = lazy(() => import("./pages/Invoices"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Only show toast for failed queries that aren't background refetches
      // unless it's a critical network error
      if (query.state.data === undefined || (error as any).code === 'ERR_NETWORK') {
        logError(`Query Error: ${query.queryKey}`, error);
        toast.error(getErrorMessage(error, 'Failed to fetch data'));
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      // Global fallback for mutation errors if not handled locally
      // Most of our mutations have local onError, but this ensures nothing is missed
      logError(`Mutation Error: ${mutation.options.mutationKey}`, error);
      // We don't toast here to avoid duplicates if local onError exists
      // but we could if we wanted a universal safety net
    },
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnMount: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

const App = () => {
  // Global fix: Prevent scroll-to-change on number inputs
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const target = document.activeElement as HTMLElement;
      if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'number') {
        target.blur();
      }
    };
    document.addEventListener('wheel', handleWheel, { passive: true });
    return () => document.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <Suspense fallback={<PageLoader />}>
                <ErrorBoundary>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route
                      path="/"
                      element={
                        <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                          <Dashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/companies"
                      element={
                        <ProtectedRoute>
                          <Companies />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/inward"
                      element={
                        <ProtectedRoute>
                          <Inward />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/outward"
                      element={
                        <ProtectedRoute>
                          <Outward />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/transporters"
                      element={
                        <ProtectedRoute>
                          <Transporters />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/invoices"
                      element={
                        <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                          <Invoices />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/settings"
                      element={
                        <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                          <Settings />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </ErrorBoundary>
              </Suspense>
            </TooltipProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
