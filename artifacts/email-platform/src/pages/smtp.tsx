import { useState } from "react";
import { useListSmtpAccounts, useDeleteSmtpAccount, useTestSmtpAccount, useToggleSmtpAccount } from "@workspace/api-client-react";
import { getListSmtpAccountsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Server, Trash2, Edit2, Plus, ShieldCheck, ShieldAlert, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { SmtpDialog } from "@/components/forms/smtp-dialog";

export default function SmtpAccounts() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);

  const { data: accounts, isLoading } = useListSmtpAccounts();
  const deleteAccount = useDeleteSmtpAccount();
  const toggleAccount = useToggleSmtpAccount();
  const testAccount = useTestSmtpAccount();
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleCreate = () => {
    setEditingAccount(null);
    setDialogOpen(true);
  };

  const handleEdit = (account: any) => {
    setEditingAccount(account);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this SMTP account?")) return;
    try {
      await deleteAccount.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListSmtpAccountsQueryKey() });
      toast({ title: "Account deleted" });
    } catch (e) {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const handleToggle = async (id: string, isEnabled: boolean) => {
    try {
      await toggleAccount.mutateAsync({ id, data: { isEnabled } });
      queryClient.invalidateQueries({ queryKey: getListSmtpAccountsQueryKey() });
      toast({ title: isEnabled ? "Account enabled" : "Account disabled" });
    } catch (e) {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  const handleTest = async (id: string) => {
    try {
      const result = await testAccount.mutateAsync({ id });
      if (result.success) {
        toast({ title: "Connection successful", description: result.message });
      } else {
        toast({ title: "Connection failed", description: result.message, variant: "destructive" });
      }
      queryClient.invalidateQueries({ queryKey: getListSmtpAccountsQueryKey() });
    } catch (e) {
      toast({ title: "Test failed to execute", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SMTP Accounts</h1>
          <p className="text-muted-foreground mt-1">Configure your email sending providers</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Host</TableHead>
              <TableHead>Limits (Hr/Day)</TableHead>
              <TableHead>Usage Today</TableHead>
              <TableHead>Health</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-8 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : accounts?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                  <Server className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-lg font-medium text-foreground mb-1">No SMTP accounts</p>
                  <p className="text-sm max-w-sm mx-auto">Add your first SMTP configuration (e.g. SendGrid, Mailgun) to start sending campaigns.</p>
                </TableCell>
              </TableRow>
            ) : (
              accounts?.map((account) => (
                <TableRow key={account.id} className={!account.isEnabled ? "opacity-60 bg-muted/20" : ""}>
                  <TableCell>
                    <Switch 
                      checked={account.isEnabled} 
                      onCheckedChange={(c) => handleToggle(account.id, c)} 
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{account.name}</span>
                      <span className="text-xs text-muted-foreground font-normal">Priority: {account.priority}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-mono text-sm">{account.host}:{account.port}</span>
                      <span className="text-xs text-muted-foreground uppercase">{account.encryption}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {account.hourlyLimit ? account.hourlyLimit.toLocaleString() : '∞'} / {' '}
                    {account.dailyLimit ? account.dailyLimit.toLocaleString() : '∞'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium">{account.sentToday?.toLocaleString() || 0}</div>
                      {account.dailyLimit && (
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary" 
                            style={{ width: `${Math.min(100, ((account.sentToday || 0) / account.dailyLimit) * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {account.health === 'healthy' ? (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-none">
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        Healthy
                      </Badge>
                    ) : account.health === 'unhealthy' ? (
                      <Badge variant="destructive" className="border-none">
                        <ShieldAlert className="h-3 w-3 mr-1" />
                        Failing
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        <Activity className="h-3 w-3 mr-1" />
                        Unknown
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleTest(account.id)}
                        disabled={testAccount.isPending}
                      >
                        Test Connection
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(account)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(account.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <SmtpDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={editingAccount}
      />
    </div>
  );
}
