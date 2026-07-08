import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { AuthProvider, useAuth } from "@/hooks/use-auth";

// Pages
import Dashboard from "@/pages/dashboard";
import Inbox from "@/pages/inbox";
import Leads from "@/pages/leads";
import AiSettings from "@/pages/ai-settings";
import Contacts from "@/pages/contacts";
import Groups from "@/pages/groups";
import Templates from "@/pages/templates";
import SmtpAccounts from "@/pages/smtp";
import Campaigns from "@/pages/campaigns";
import CampaignDetail from "@/pages/campaign-detail";
import Logs from "@/pages/logs";
import Reports from "@/pages/reports";
import Login from "@/pages/login";

const queryClient = new QueryClient();

function Router() {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user && location !== "/login") {
      setLocation("/login");
    }
  }, [user, loading, location, setLocation]);

  useEffect(() => {
    if (!loading && user && location === "/login") {
      setLocation("/");
    }
  }, [user, loading, location, setLocation]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading session...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/inbox" component={Inbox} />
        <Route path="/leads" component={Leads} />
        <Route path="/ai-settings" component={AiSettings} />
        <Route path="/contacts" component={Contacts} />
        <Route path="/groups" component={Groups} />
        <Route path="/templates" component={Templates} />
        <Route path="/smtp" component={SmtpAccounts} />
        <Route path="/campaigns" component={Campaigns} />
        <Route path="/campaigns/:id" component={CampaignDetail} />
        <Route path="/logs" component={Logs} />
        <Route path="/reports" component={Reports} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
