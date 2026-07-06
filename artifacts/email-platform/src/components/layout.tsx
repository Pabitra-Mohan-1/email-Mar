import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  FolderHeart, 
  FileText, 
  Server, 
  Send, 
  ScrollText, 
  BarChart3,
  LogOut,
  Mail,
  Sparkles,
  Brain
} from "lucide-react";
import { cn } from "@/lib/utils";

import { useAuth } from "@/hooks/use-auth";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: Mail },
  { href: "/leads", label: "Email Leads", icon: Sparkles },
  { href: "/ai-settings", label: "AI Config", icon: Brain },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/groups", label: "Groups", icon: FolderHeart },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/smtp", label: "Sender & Email", icon: Server },
  { href: "/campaigns", label: "Campaigns", icon: Send },
  { href: "/logs", label: "Email Logs", icon: ScrollText },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r bg-background sm:flex">
        <div className="flex h-14 items-center border-b px-6">
          <div className="flex items-center gap-2 font-semibold">
            <Send className="h-5 w-5 text-primary" />
            <span>Sender</span>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t space-y-2">
          {user && (
            <div className="px-3 text-xs text-muted-foreground truncate" title={user.email}>
              Admin:<br/>
              <span className="font-semibold text-foreground">{user.email}</span>
            </div>
          )}
          <button 
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer text-left bg-transparent border-0"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 sm:pl-64 flex flex-col">
        <div className="flex-1 p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
