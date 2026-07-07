import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Sparkles, Mail, MessageSquare, ChevronRight, User, Calendar, 
  AlertCircle, ShieldCheck, CheckSquare, Eye, ExternalLink, RefreshCw
} from "lucide-react";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { format, formatDistanceToNow } from "date-fns";

interface LeadItem {
  _id: string;
  fromName: string | null;
  fromAddress: string;
  toAddress: string;
  subject: string;
  text: string;
  html: string;
  date: string;
  leadStatus: string;
  aiReason: string;
  aiDraft: string;
  aiSummary: string;
  actionStatus: string;
  accountId: {
    _id: string;
    name: string;
    username: string;
  } | null;
}

export default function Leads() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isReclassifying, setIsReclassifying] = useState(false);

  // 1. Fetch leads
  const { data: leads = [], isLoading, refetch } = useQuery<LeadItem[]>({
    queryKey: ["leads"],
    queryFn: async () => {
      const res = await fetch("/api/inbox/leads");
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    }
  });

  // 2. Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, actionStatus }: { id: string; actionStatus: string }) => {
      const res = await fetch(`/api/inbox/leads/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({ title: "Status updated successfully" });
    }
  });

  // 3. Send reply mutation
  const handleSendReply = async () => {
    if (!selectedLead || !replyBody.trim()) return;
    setIsSendingReply(true);

    try {
      const res = await fetch("/api/inbox/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedLead.accountId?._id || "",
          to: selectedLead.fromAddress,
          subject: selectedLead.subject,
          body: replyBody,
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send email");

      toast({ title: "Reply sent successfully!" });
      setReplyBody("");
      
      // Update action status to replied
      await updateStatusMutation.mutateAsync({ id: selectedLead._id, actionStatus: "replied" });
      setSelectedLead(null);
    } catch (err: any) {
      toast({
        title: "Reply failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleReclassify = async () => {
    setIsReclassifying(true);
    try {
      const res = await fetch("/api/inbox/leads/reclassify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reclassify failed");
      toast({ title: "AI classification started", description: data.message });
      // Give the background job a moment, then refresh; user can also hit Refresh Leads.
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["leads"] }), 4000);
    } catch (err: any) {
      toast({ title: "Reclassify failed", description: err.message, variant: "destructive" });
    } finally {
      setIsReclassifying(false);
    }
  };

  const openLeadDetail = (lead: LeadItem) => {
    setSelectedLead(lead);
    setReplyBody(lead.aiDraft || "");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
      case "replied":
        return <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">Replied</Badge>;
      case "ignored":
        return <Badge variant="outline" className="text-muted-foreground bg-muted/30">Ignored</Badge>;
      case "follow_up":
        return <Badge variant="default" className="bg-blue-50 text-blue-700 border-blue-200">Follow Up</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary animate-pulse" />
            Email Leads
          </h1>
          <p className="text-muted-foreground mt-1">
            Review and follow up with leads automatically classified as "Interested" by AI.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            onClick={handleReclassify}
            disabled={isReclassifying}
            className="gap-2"
          >
            <Sparkles className={`h-4 w-4 ${isReclassifying ? "animate-spin" : ""}`} />
            {isReclassifying ? "Analyzing..." : "Run AI Classification"}
          </Button>
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh Leads
          </Button>
        </div>
      </div>

      <div className="border rounded-md bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prospect</TableHead>
              <TableHead>Lead From</TableHead>
              <TableHead className="max-w-[340px]">AI Summary</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-sm text-muted-foreground">
                  Loading leads...
                </TableCell>
              </TableRow>
            ) : leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                  <Sparkles className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-lg font-medium text-foreground mb-1">No AI leads found</p>
                  <p className="text-sm max-w-md mx-auto">
                    Configure your AI settings and refresh your inbox. Incoming replies will be analyzed for interest automatically.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => (
                <TableRow key={lead._id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">{lead.fromName || "Unknown Prospect"}</span>
                      <span className="text-xs text-muted-foreground">{lead.fromAddress}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{lead.accountId?.name || "Shared"}</span>
                      <span className="text-[10px] text-muted-foreground">{lead.accountId?.username || lead.toAddress}</span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[340px]">
                    {lead.aiSummary ? (
                      <div className="flex items-start gap-1 text-[11px] text-muted-foreground leading-snug">
                        <MessageSquare className="h-3 w-3 mt-0.5 shrink-0 text-primary/70" />
                        <span className="line-clamp-3">{lead.aiSummary}</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/50 italic">Pending…</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(lead.date), "MMM d, yyyy h:mm a")}
                  </TableCell>
                  <TableCell>
                    <select
                      value={lead.actionStatus}
                      onChange={(e) => updateStatusMutation.mutate({ id: lead._id, actionStatus: e.target.value })}
                      className="text-xs border rounded px-1.5 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="pending">Pending</option>
                      <option value="replied">Replied</option>
                      <option value="follow_up">Follow Up</option>
                      <option value="ignored">Ignored</option>
                    </select>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setLocation(`/inbox?email=${encodeURIComponent(lead.fromAddress)}`)
                        }
                        className="gap-1.5"
                        title="Open this conversation in the Inbox"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Inbox mail
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openLeadDetail(lead)}
                        className="gap-1.5"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        View & Reply
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* View Lead Detail & Reply Dialog */}
      <Dialog open={selectedLead !== null} onOpenChange={(o) => !o && setSelectedLead(null)}>
        {selectedLead && (
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                Prospect: {selectedLead.fromName || selectedLead.fromAddress}
              </DialogTitle>
            </DialogHeader>

            <ScrollArea className="flex-1 pr-2 space-y-4 py-4 min-h-[250px] max-h-[400px]">
              {/* Original Message Card */}
              <Card className="border-l-4 border-l-blue-600 bg-blue-50/10 dark:bg-blue-950/10">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground border-b pb-2">
                    <div>
                      From: <span className="font-semibold text-foreground">{selectedLead.fromAddress}</span>
                    </div>
                    <div>
                      Date: {format(new Date(selectedLead.date), "PPP p")}
                    </div>
                  </div>
                  <div className="text-sm font-bold">{selectedLead.subject}</div>
                  <div className="border rounded p-3 bg-background text-xs whitespace-pre-line leading-relaxed max-h-[150px] overflow-y-auto">
                    {selectedLead.text || "No text content"}
                  </div>
                </CardContent>
              </Card>

              {/* AI Conversation Summary */}
              {selectedLead.aiSummary && (
                <div className="p-3 border rounded-md bg-primary/5 border-primary/20 space-y-1.5">
                  <div className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    AI Conversation Summary
                  </div>
                  <p className="text-xs leading-relaxed text-foreground/90">
                    {selectedLead.aiSummary}
                  </p>
                </div>
              )}

              {/* AI Classification Info */}
              <div className="p-3 border rounded-md bg-muted/30 space-y-1.5">
                <div className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  AI Classification Analysis
                </div>
                <p className="text-xs leading-relaxed text-foreground/80 italic">
                  "{selectedLead.aiReason}"
                </p>
              </div>
            </ScrollArea>

            {/* Reply Editor */}
            <div className="border-t pt-4 space-y-3 mt-auto">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Replying From: <span className="font-semibold text-foreground">{selectedLead.accountId?.username || selectedLead.toAddress}</span></span>
                <span className="text-[10px] text-primary bg-primary/15 px-1.5 py-0.5 rounded font-bold">AI Draft Loaded</span>
              </div>
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="Type your response..."
                rows={5}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                disabled={isSendingReply}
              />
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSelectedLead(null)} disabled={isSendingReply}>
                  Cancel
                </Button>
                <Button onClick={handleSendReply} disabled={isSendingReply || !replyBody.trim()}>
                  {isSendingReply ? "Sending..." : "Send Reply"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
