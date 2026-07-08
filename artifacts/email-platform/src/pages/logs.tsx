import { useState } from "react";
import { useListEmailLogs, useDeleteEmailLog, useClearEmailLogs, getListEmailLogsQueryKey } from "@workspace/api-client-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatLogTimeIST } from "@/lib/datetime";
import { FileText, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Logs() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: logsData, isLoading } = useListEmailLogs({
    page,
    limit,
  });

  const deleteLog = useDeleteEmailLog();
  const clearLogs = useClearEmailLogs();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDelete = async (id: string) => {
    try {
      await deleteLog.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListEmailLogsQueryKey() });
      toast({ title: "Email log deleted successfully" });
    } catch (e) {
      toast({ title: "Failed to delete log", variant: "destructive" });
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Are you sure you want to clear all email logs? This action cannot be undone.")) {
      return;
    }
    try {
      await clearLogs.mutateAsync();
      queryClient.invalidateQueries({ queryKey: getListEmailLogsQueryKey() });
      setPage(1);
      toast({ title: "All email logs cleared successfully" });
    } catch (e) {
      toast({ title: "Failed to clear logs", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-emerald-500 hover:bg-emerald-600">Sent</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-500">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Logs</h1>
          <p className="text-muted-foreground mt-1">Detailed history of all email deliveries</p>
        </div>
        {logsData?.logs && logsData.logs.length > 0 && (
          <Button 
            variant="destructive"
            onClick={handleClearAll}
            disabled={clearLogs.isPending}
          >
            Clear All Logs
          </Button>
        )}
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Details</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : logsData?.logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-lg font-medium text-foreground mb-1">No logs found</p>
                </TableCell>
              </TableRow>
            ) : (
              logsData?.logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {formatLogTimeIST(log.createdAt)}
                  </TableCell>
                  <TableCell className="font-medium">{log.recipient}</TableCell>
                  <TableCell>{log.campaignName || <span className="text-muted-foreground italic">Direct</span>}</TableCell>
                  <TableCell>{getStatusBadge(log.status)}</TableCell>
                  <TableCell className="max-w-[300px] truncate text-xs text-muted-foreground">
                    {log.error || log.smtpResponse || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                      onClick={() => handleDelete(log.id)}
                      disabled={deleteLog.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {logsData && logsData.total > limit && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, logsData.total)} of {logsData.total} entries
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Prev
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={page * limit >= logsData.total}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
