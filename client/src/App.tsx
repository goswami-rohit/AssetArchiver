import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import VendorsTable from "./components/vendors-table";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login"; // ← ADD THIS
import CRMDashboard from "@/pages/CRMDashboard"; // ← WE'LL CREATE THIS NEXT
import ProtectedRoute from "@/components/ProtectedRoute"; // ← WE'LL CREATE THIS

function Router() {
  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/login" component={Login} />
      
      {/* Protected Routes */}
      <Route path="/crm">
        <ProtectedRoute>
          <CRMDashboard />
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