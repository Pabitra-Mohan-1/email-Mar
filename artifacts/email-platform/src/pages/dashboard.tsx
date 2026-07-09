import { useGetDashboardStats, useGetDashboardRecentActivity, useGetDailyReports, useListCampaigns, useUpdateCampaignStatus, getListCampaignsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Mail, Activity, AlertCircle, CheckCircle2, Clock, Send, Server, Loader2, Pause, XCircle } from "lucide-react";
import { format } from "date-fns";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: activity, isLoading: activityLoading } = useGetDashboardRecentActivity();
  const { data: dailyReports, isLoading: dailyLoading } = useGetDailyReports();

  const { data: campaigns } = useListCampaigns(undefined, {
    query: {
      refetchInterval: (query: any) => {
        const data = query?.state?.data;
        const hasRunning = Array.isArray(data) && data.some((c: any) => c.status === "running");
        return hasRunning ? 3000 : false;
      }
    } as any
  });
  const updateStatus = useUpdateCampaignStatus();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleStatusChange = async (id: string, status: any) => {
    try {
      await updateStatus.mutateAsync({ id, data: { status } });
      queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
      toast({ title: `Campaign ${status}` });
    } catch (e) {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  const runningCampaigns = campaigns?.filter((c: any) => c.status === "running") || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      </div>

      {runningCampaigns.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Active Sendings</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {runningCampaigns.map((campaign) => {
              const sent = campaign.sentCount || 0;
              const failed = campaign.failedCount || 0;
              const total = campaign.totalRecipients || 0;
              const processed = sent + failed;
              const progress = total > 0 ? (processed / total) * 100 : 0;
              
              return (
                <div key={campaign.id} className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-blue-950/20 dark:to-indigo-950/10 p-6 shadow-sm">
                  <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />
                  
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 dark:bg-blue-900/40 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Live Sending
                      </span>
                      <h3 className="text-lg font-bold tracking-tight mt-1.5">
                        <Link href={`/campaigns/${campaign.id}`} className="hover:underline">
                          {campaign.name}
                        </Link>
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-1">{campaign.subject}</p>
                    </div>
                    
                    <div className="flex gap-1.5">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-8 border-amber-200 bg-amber-50/50 hover:bg-amber-100 dark:border-amber-900/30 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300"
                        onClick={() => handleStatusChange(campaign.id, 'paused')}
                      >
                        <Pause className="mr-1.5 h-3.5 w-3.5" />
                        Pause
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-8 border-red-200 bg-red-50/50 hover:bg-red-100 dark:border-red-900/30 dark:bg-red-950/20 text-red-700 dark:text-red-300"
                        onClick={() => handleStatusChange(campaign.id, 'cancelled')}
                      >
                        <XCircle className="mr-1.5 h-3.5 w-3.5" />
                        Cancel
                      </Button>
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-background/60 dark:bg-background/40 p-2.5 border">
                        <div className="text-xs text-muted-foreground font-medium">Delivered</div>
                        <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{sent}</div>
                      </div>
                      <div className="rounded-lg bg-background/60 dark:bg-background/40 p-2.5 border">
                        <div className="text-xs text-muted-foreground font-medium">Failed</div>
                        <div className="text-lg font-bold text-destructive mt-0.5">{failed}</div>
                      </div>
                      <div className="rounded-lg bg-background/60 dark:bg-background/40 p-2.5 border">
                        <div className="text-xs text-muted-foreground font-medium">Total</div>
                        <div className="text-lg font-bold mt-0.5">{total}</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground font-medium">Overall Progress</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">{Math.round(progress)}%</span>
                      </div>
                      <div className="relative w-full h-3 bg-muted rounded-full overflow-hidden shadow-inner border border-muted-foreground/10">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 rounded-full animate-pulse"
                          style={{ width: `${Math.min(100, progress)}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-muted-foreground flex justify-between">
                        <span>{processed} of {total} emails processed</span>
                        {total - processed > 0 && (
                          <span>{total - processed} remaining</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Contacts"
          value={stats?.totalContacts}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          loading={statsLoading}
        />
        <StatCard
          title="Emails Sent Today"
          value={stats?.emailsSentToday}
          icon={<Send className="h-4 w-4 text-muted-foreground" />}
          loading={statsLoading}
        />
        <StatCard
          title="Success Rate"
          value={stats?.successRate != null ? `${(stats.successRate * 100).toFixed(1)}%` : undefined}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          loading={statsLoading}
        />
        <StatCard
          title="Pending Queue"
          value={stats?.pendingQueue}
          icon={<Clock className="h-4 w-4 text-amber-500" />}
          loading={statsLoading}
        />
        <StatCard
          title="Failed Emails"
          value={stats?.failedEmails}
          icon={<AlertCircle className="h-4 w-4 text-destructive" />}
          loading={statsLoading}
        />
        <StatCard
          title="Active Campaigns"
          value={stats?.totalCampaigns}
          icon={<Activity className="h-4 w-4 text-blue-500" />}
          loading={statsLoading}
        />
        <StatCard
          title="Total Sent (All Time)"
          value={stats?.totalEmailsSent}
          icon={<Mail className="h-4 w-4 text-muted-foreground" />}
          loading={statsLoading}
        />
        <StatCard
          title="SMTP Accounts"
          value={stats?.smtpAccounts}
          icon={<Server className="h-4 w-4 text-muted-foreground" />}
          loading={statsLoading}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Daily Volume</CardTitle>
            <CardDescription>Emails sent over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            {dailyLoading ? (
              <Skeleton className="w-full h-full" />
            ) : dailyReports && dailyReports.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyReports}>
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => format(new Date(val), "MMM d")}
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }}
                    labelFormatter={(val) => format(new Date(val), "MMM d, yyyy")}
                  />
                  <Bar dataKey="sent" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="failed" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest campaign actions and events</CardDescription>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : Array.isArray(activity) && activity.length > 0 ? (
              <div className="space-y-8">
                {activity.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-start gap-4">
                    <div className="rounded-full bg-primary/10 p-2 flex-shrink-0">
                      <Activity className="h-4 w-4 text-primary" />
                    </div>
                    <div className="grid gap-1">
                      <p className="text-sm font-medium leading-none">{item.message}</p>
                      {item.campaignName && (
                        <p className="text-sm text-muted-foreground">{item.campaignName}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(item.createdAt), "MMM d, h:mm a")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                No recent activity
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, loading }: { title: string; value?: React.ReactNode; icon: React.ReactNode; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="text-2xl font-bold">{value !== undefined ? value : "0"}</div>
        )}
      </CardContent>
    </Card>
  );
}
