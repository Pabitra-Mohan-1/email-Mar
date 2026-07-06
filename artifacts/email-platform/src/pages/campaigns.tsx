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
import { format } from "date-fns";
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
                        ? format(new Date(campaign.scheduledAt), "MMM d, yyyy h:mm a") 
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
