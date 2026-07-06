import { useGetDashboardStats, useGetDashboardRecentActivity, useGetDailyReports } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Mail, Activity, AlertCircle, CheckCircle2, Clock, Send, Server } from "lucide-react";
import { format } from "date-fns";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: activity, isLoading: activityLoading } = useGetDashboardRecentActivity();
  const { data: dailyReports, isLoading: dailyLoading } = useGetDailyReports();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      </div>

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
