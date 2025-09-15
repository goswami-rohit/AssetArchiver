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

// form componnets import 
import DVRForm from '@/pages/forms/DVRForm';
import TVRForm from '@/pages/forms/TVRForm';
import AddPJPForm from '@/pages/forms/AddPJPForm';
import AddDealerForm from '@/pages/forms/AddDealerForm';
import AddSiteForm from "./pages/forms/AddSiteForm";
import CompetitionReportForm from "./pages/forms/CompetitionReportForm";
import DailyTasksForm from "./pages/forms/DailyTasksForm";
import LeaveApplicationForm from "./pages/forms/LeaveApplicationForm";
import SalesOrderForm from "./pages/forms/SalesOrderForm";

//import CRMDashboard from "@/pages/CRMDashboard"; 
import ProtectedRoute from "@/components/ProtectedRoute";
import PJPListPage from "./components/PJPListPage";

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
            <JourneyTracker />
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

      {/* form navigations */}
      <Route path="/dvr-form">
        <ProtectedRoute>
          <AppShell>
            <DVRForm />
          </AppShell>
        </ProtectedRoute>
      </Route>

      <Route path="/tvr-form">
        <ProtectedRoute>
          <AppShell>
            <TVRForm />
          </AppShell>
        </ProtectedRoute>
      </Route>

      <Route path="/pjp-form">
        <ProtectedRoute>
          <AppShell>
            <AddPJPForm />
          </AppShell>
        </ProtectedRoute>
      </Route>

      <Route path="/dealer-form">
        <ProtectedRoute>
          <AppShell>
            <AddDealerForm />
          </AppShell>
        </ProtectedRoute>
      </Route>

      <Route path="/site-form">
        <ProtectedRoute>
          <AppShell>
            <AddSiteForm />
          </AppShell>
        </ProtectedRoute>
      </Route>

      <Route path="/daily-tasks-form">
        <ProtectedRoute>
          <AppShell>
            <DailyTasksForm />
          </AppShell>
        </ProtectedRoute>
      </Route>

      <Route path="/competition-form">
        <ProtectedRoute>
          <AppShell>
            <CompetitionReportForm />
          </AppShell>
        </ProtectedRoute>
      </Route>

      <Route path="/leave-form">
        <ProtectedRoute>
          <AppShell>
            <LeaveApplicationForm />
          </AppShell>
        </ProtectedRoute>
      </Route>

      <Route path="/sales-order-form">
        <ProtectedRoute>
          <AppShell>
            <SalesOrderForm />
          </AppShell>
        </ProtectedRoute>
      </Route>
      {/*End of form routes */}

    {/*Direct buttons routing from Home/Profile/Journey Pages */}
      <Route path="/pjp-list">
        <ProtectedRoute>
          <AppShell>
            <PJPListPage />
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