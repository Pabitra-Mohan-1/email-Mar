import { useParams } from "wouter";
import { useGetCampaign } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, CheckCircle2, XCircle, Users, Activity, BarChart2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function CampaignDetail() {
  const { id } = useParams();
  const { data: campaign, isLoading } = useGetCampaign(id || "", {
    query: { enabled: !!id } as any
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!campaign) {
    return <div>Campaign not found.</div>;
  }

  const successRate = campaign.sentCount && campaign.totalRecipients
    ? ((campaign.sentCount / (campaign.sentCount + (campaign.failedCount || 0))) * 100).toFixed(1)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            {campaign.name}
            <Badge variant="outline" className="text-sm font-normal">
              {campaign.status}
            </Badge>
          </h1>
          <p className="text-muted-foreground mt-1">{campaign.subject}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recipients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.totalRecipients || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.sentCount || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.failedCount || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate}%</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5" />
            Campaign Details
          </CardTitle>
          <CardDescription>Configuration and metadata</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Sender</dt>
              <dd className="mt-1 text-sm">{campaign.senderName} &lt;{campaign.senderEmail}&gt;</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Schedule</dt>
              <dd className="mt-1 text-sm">{campaign.scheduledAt || "Not scheduled"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Limits</dt>
              <dd className="mt-1 text-sm">
                Hourly: {campaign.hourlyLimit || "∞"} | Daily: {campaign.dailyLimit || "∞"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
