import { useState } from "react";
import { Link } from "wouter";
import { useListCampaigns, useDeleteCampaign, useUpdateCampaignStatus, useCreateCampaign } from "@workspace/api-client-react";
import { getListCampaignsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, Trash2, Plus, Play, Pause, XCircle, Pencil, RotateCcw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { formatScheduleIST } from "@/lib/datetime";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { CampaignStatus, CampaignStatusInputStatus } from "@workspace/api-client-react";
import { CampaignDialog } from "@/components/forms/campaign-dialog";

export default function Campaigns() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);

  const { data: campaigns, isLoading } = useListCampaigns(undefined, {
    query: {
      refetchInterval: (query: any) => {
        const data = query?.state?.data;
        const hasRunning = Array.isArray(data) && data.some((c: any) => c.status === "running");
        return hasRunning ? 3000 : false;
      }
    } as any
  });
  const deleteCampaign = useDeleteCampaign();
  const updateStatus = useUpdateCampaignStatus();
  const createCampaign = useCreateCampaign();
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const runningCampaigns = campaigns?.filter((c: any) => c.status === "running") || [];

  const handleCreate = () => {
    setSelectedCampaign(null);
    setDialogOpen(true);
  };

  const handleEdit = (campaign: any) => {
    setSelectedCampaign(campaign);
    setDialogOpen(true);
  };

  const handleResend = async (campaign: any) => {
    try {
      const payload = {
        name: `${campaign.name} (Copy)`,
        subject: campaign.subject,
        senderName: campaign.senderName,
        senderEmail: campaign.senderEmail,
        smtpAccountId: campaign.smtpAccountId || undefined,
        templateId: campaign.templateId || undefined,
        groupId: campaign.groupId || undefined,
        status: "draft" as any,
      };
      await createCampaign.mutateAsync({ data: payload });
      queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
      toast({ title: "Campaign cloned as draft" });
    } catch (e) {
      toast({ title: "Failed to clone campaign", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;
    try {
      await deleteCampaign.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
      toast({ title: "Campaign deleted" });
    } catch (e) {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const handleStatusChange = async (id: string, status: CampaignStatusInputStatus) => {
    try {
      await updateStatus.mutateAsync({ id, data: { status } });
      queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
      toast({ title: `Campaign ${status}` });
    } catch (e) {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return (
          <Badge className="bg-blue-500 hover:bg-blue-600 flex items-center gap-1 w-fit">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Running
          </Badge>
        );
      case 'scheduled':
        return <Badge className="bg-amber-500 hover:bg-amber-600">Scheduled</Badge>;
      case 'paused':
        return <Badge variant="secondary">Paused</Badge>;
      case 'completed':
        return <Badge className="bg-emerald-500 hover:bg-emerald-600">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground mt-1">Manage and track your email broadcasts</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Campaign
        </Button>
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
                  {/* Decorative ambient background glow */}
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
                    {/* Progress Stats */}
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

                    {/* Progress Bar & Percentage */}
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

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : campaigns?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-16 text-muted-foreground">
                  <Send className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-lg font-medium text-foreground mb-1">No campaigns found</p>
                  <p className="text-sm">Create your first campaign to start sending emails.</p>
                </TableCell>
              </TableRow>
            ) : (
              campaigns?.map((campaign) => {
                const progress = campaign.totalRecipients 
                  ? ((campaign.sentCount || 0) + (campaign.failedCount || 0)) / campaign.totalRecipients * 100 
                  : 0;

                return (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <div className="font-medium">
                        <Link href={`/campaigns/${campaign.id}`} className="hover:underline">
                          {campaign.name}
                        </Link>
                      </div>
                      <div className="text-xs text-muted-foreground">{campaign.subject}</div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(campaign.status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 max-w-[200px]">
                        <div className="flex justify-between text-xs">
                          <span>{(campaign.sentCount || 0) + (campaign.failedCount || 0)} / {campaign.totalRecipients || 0}</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full bg-primary transition-all duration-500 ${campaign.status === 'running' ? 'animate-pulse' : ''}`}
                            style={{ width: `${Math.min(100, progress)}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {campaign.scheduledAt
                        ? formatScheduleIST(campaign.scheduledAt)
                        : <span className="text-muted-foreground italic">Not scheduled</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {campaign.status === 'draft' || campaign.status === 'paused' ? (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            onClick={() => handleStatusChange(campaign.id, 'running')}
                            title="Start Campaign"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        ) : campaign.status === 'running' || campaign.status === 'scheduled' ? (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                            onClick={() => handleStatusChange(campaign.id, 'paused')}
                            title="Pause Campaign"
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        ) : null}
                        
                        {(campaign.status === 'running' || campaign.status === 'paused' || campaign.status === 'scheduled') && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleStatusChange(campaign.id, 'cancelled')}
                            title="Cancel Campaign"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}

                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                          onClick={() => handleEdit(campaign)}
                          title="Edit Campaign"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10"
                          onClick={() => handleResend(campaign)}
                          title="Clone/Resend Campaign"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(campaign.id)}
                          title="Delete Campaign"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <CampaignDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        campaign={selectedCampaign}
      />
    </div>
  );
}
