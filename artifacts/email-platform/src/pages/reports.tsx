import { useGetCampaignReports, useGetSmtpReports, useGetDailyReports } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { BarChart3 } from "lucide-react";

export default function Reports() {
  const { data: campaignReports, isLoading: campaignsLoading } = useGetCampaignReports();
  const { data: smtpReports, isLoading: smtpLoading } = useGetSmtpReports();
  const { data: dailyReports, isLoading: dailyLoading } = useGetDailyReports();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-1">Analytics and performance metrics</p>
        </div>
      </div>

      <Card className="col-span-full">
        <CardHeader>
          <CardTitle>Daily Volume (Last 30 Days)</CardTitle>
          <CardDescription>Aggregate view of sent and failed emails</CardDescription>
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
                <Bar dataKey="sent" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Sent" />
                <Bar dataKey="failed" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground flex-col">
              <BarChart3 className="h-10 w-10 text-muted-foreground/30 mb-2" />
              No data available
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Campaign Performance</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaignsLoading ? (
                  <TableRow><TableCell colSpan={3}><Skeleton className="h-8" /></TableCell></TableRow>
                ) : campaignReports?.map(report => (
                  <TableRow key={report.campaignId}>
                    <TableCell className="font-medium">{report.campaignName}</TableCell>
                    <TableCell className="text-right">{report.sentCount}</TableCell>
                    <TableCell className="text-right text-emerald-600 font-medium">
                      {(report.successRate * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SMTP Provider Performance</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-right">Total Sent</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {smtpLoading ? (
                  <TableRow><TableCell colSpan={3}><Skeleton className="h-8" /></TableCell></TableRow>
                ) : smtpReports?.map(report => (
                  <TableRow key={report.smtpId}>
                    <TableCell className="font-medium">{report.smtpName}</TableCell>
                    <TableCell className="text-right">{report.totalSent}</TableCell>
                    <TableCell className="text-right text-emerald-600 font-medium">
                      {(report.successRate * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
