// src/App.tsx

import AppShell from "@/components/AppShell";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import VendorsTable from "./components/vendors-table";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login"; 

import HomePage from "@/pages/HomePage";
import ProfilePage from "@/pages/ProfilePage";
import JourneyTracker from "@/pages/JourneyTracker";
import ChatInterface from "@/pages/ChatInterface";
//import CRMDashboard from "@/pages/CRMDashboard"; 
import ProtectedRoute from "@/components/ProtectedRoute"; 

function Router() {
  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/login" component={Login} />

      {/* Protected Routes */}
      <Route path="/crm">
        <ProtectedRoute>
          <AppShell>
            <HomePage />
          </AppShell>
        </ProtectedRoute>
      </Route>

      <Route path="/crm/ai">
        <ProtectedRoute>
          <AppShell>
            <ChatInterface />
          </AppShell>
        </ProtectedRoute>
      </Route>

      <Route path="/crm/journey">
        <ProtectedRoute>
          <AppShell>
            <JourneyTracker userId={1} />
          </AppShell>
        </ProtectedRoute>
      </Route>

      <Route path="/crm/profile">
        <ProtectedRoute>
          <AppShell>
            <ProfilePage />
          </AppShell>
        </ProtectedRoute>
      </Route>

      {/* Your Existing Routes */}
      <Route path="/" component={Dashboard} />
      <Route path="/vendors" component={VendorsTable} />

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;