import { useState } from "react";
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
  Brain,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full flex-col sm:flex-row bg-muted/40">
      {/* Mobile Header */}
      <header className="flex h-16 w-full items-center justify-between border-b bg-background px-6 sm:hidden sticky top-0 z-20">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <img
            src="/logo.png"
            alt="Worklance Sender AI"
            className="h-10 max-w-full object-contain"
          />
        </Link>
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-64 p-0 flex flex-col h-full bg-background border-r"
          >
            <div className="flex h-20 items-center border-b px-6 py-2">
              <Link
                href="/"
                className="flex items-center gap-2 font-semibold"
                onClick={() => setMobileMenuOpen(false)}
              >
                <img
                  src="/logo.png"
                  alt="Worklance Sender AI"
                  className="h-12 max-w-full object-contain"
                />
              </Link>
            </div>
            <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  location === item.href ||
                  (item.href !== "/" && location.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
                <div
                  className="px-3 text-xs text-muted-foreground truncate"
                  title={user.email}
                >
                  Admin:
                  <br />
                  <span className="font-semibold text-foreground">
                    {user.email}
                  </span>
                </div>
              )}
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer text-left bg-transparent border-0"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Sidebar (Desktop) */}
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r bg-background sm:flex">
        <div className="flex h-20 items-center border-b px-6 py-2">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <img
              src="/logo.png"
              alt="Worklance Sender AI"
              className="h-12 max-w-full object-contain"
            />
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              location === item.href ||
              (item.href !== "/" && location.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
            <div
              className="px-3 text-xs text-muted-foreground truncate"
              title={user.email}
            >
              Admin:
              <br />
              <span className="font-semibold text-foreground">
                {user.email}
              </span>
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
      <main className="flex-1 sm:pl-64 flex flex-col min-w-0">
        <div className="flex-1 p-4 sm:p-8">{children}</div>
      </main>
    </div>
  );
}
