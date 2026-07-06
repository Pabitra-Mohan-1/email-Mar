import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateSmtpAccount, useUpdateSmtpAccount, getListSmtpAccountsQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { SmtpAccountInputEncryption, SmtpAccountInputImapEncryption } from "@workspace/api-client-react";

const smtpSchema = z.object({
  name: z.string().min(1, "Name is required"),
  host: z.string().min(1, "Host is required"),
  port: z.coerce.number().min(1, "Port is required"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  encryption: z.nativeEnum(SmtpAccountInputEncryption),
  priority: z.coerce.number().optional().default(1),
  hourlyLimit: z.coerce.number().optional(),
  dailyLimit: z.coerce.number().optional(),
  isImapEnabled: z.boolean().optional(),
  imapHost: z.string().optional(),
  imapPort: z.coerce.number().optional(),
  imapEncryption: z.nativeEnum(SmtpAccountInputImapEncryption).optional(),
});

type SmtpFormValues = z.infer<typeof smtpSchema>;

interface SmtpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: any;
}

export function SmtpDialog({ open, onOpenChange, account }: SmtpDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createAccount = useCreateSmtpAccount();
  const updateAccount = useUpdateSmtpAccount();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SmtpFormValues>({
    resolver: zodResolver(smtpSchema),
    defaultValues: {
      name: "",
      host: "",
      port: 587,
      username: "",
      password: "",
      encryption: "tls",
      priority: 1,
      isImapEnabled: true,
      imapHost: "",
      imapPort: 993,
      imapEncryption: "tls",
    },
  });

  useEffect(() => {
    if (open) {
      if (account) {
        reset({ 
          name: account.name,
          host: account.host,
          port: account.port,
          username: account.username,
          password: "", // don't pre-fill password
          encryption: account.encryption,
          priority: account.priority,
          hourlyLimit: account.hourlyLimit || undefined,
          dailyLimit: account.dailyLimit || undefined,
          isImapEnabled: account.isImapEnabled ?? true,
          imapHost: account.imapHost || "",
          imapPort: account.imapPort || 993,
          imapEncryption: account.imapEncryption || "tls",
        });
      } else {
        reset({
          name: "",
          host: "",
          port: 587,
          username: "",
          password: "",
          encryption: "tls",
          priority: 1,
          isImapEnabled: true,
          imapHost: "",
          imapPort: 993,
          imapEncryption: "tls",
        });
      }
    }
  }, [open, account, reset]);

  const onSubmit = async (data: SmtpFormValues) => {
    try {
      if (account) {
        // If password is not provided on update, we shouldn't send it, but schema requires it currently or we need to omit it
        // The API might expect password only if changing, let's send what we have
        const updateData: any = { ...data };
        if (!data.password) delete updateData.password;

        await updateAccount.mutateAsync({ id: account.id, data: updateData });
        toast({ title: "SMTP Account updated successfully" });
      } else {
        await createAccount.mutateAsync({ data });
        toast({ title: "SMTP Account created successfully" });
      }
      queryClient.invalidateQueries({ queryKey: getListSmtpAccountsQueryKey() });
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Failed to save SMTP account", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{account ? "Edit SMTP Account" : "Add SMTP Account"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input id="name" placeholder="e.g. SendGrid Main" {...register("name")} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority (lower is higher)</Label>
              <Input id="priority" type="number" {...register("priority")} />
            </div>
          </div>

          <div className="grid grid-cols-[2fr_1fr_1fr] gap-4">
            <div className="space-y-2">
              <Label htmlFor="host">Host</Label>
              <Input id="host" placeholder="smtp.example.com" {...register("host")} />
              {errors.host && <p className="text-sm text-destructive">{errors.host.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input id="port" type="number" {...register("port")} />
              {errors.port && <p className="text-sm text-destructive">{errors.port.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="encryption">Encryption</Label>
              <select 
                id="encryption" 
                {...register("encryption")}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="none">None</option>
                <option value="ssl">SSL</option>
                <option value="tls">TLS</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" {...register("username")} />
              {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...register("password")} placeholder={account ? "(Leave blank to keep unchanged)" : ""} />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t mt-4">
            <div className="space-y-2">
              <Label htmlFor="hourlyLimit">Hourly Limit</Label>
              <Input id="hourlyLimit" type="number" {...register("hourlyLimit")} placeholder="Empty for unlimited" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dailyLimit">Daily Limit</Label>
              <Input id="dailyLimit" type="number" {...register("dailyLimit")} placeholder="Empty for unlimited" />
            </div>
          </div>

          <div className="pt-2 border-t mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isImapEnabled" className="text-base font-semibold">Enable IMAP Inbox Sync</Label>
                <p className="text-xs text-muted-foreground">Retrieve incoming emails using IMAP (e.g. for cPanel mail)</p>
              </div>
              <input
                id="isImapEnabled"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                {...register("isImapEnabled")}
              />
            </div>

            <div className="grid grid-cols-[2fr_1fr_1fr] gap-4">
              <div className="space-y-2">
                <Label htmlFor="imapHost">IMAP Host</Label>
                <Input id="imapHost" placeholder="e.g. imap.ionetweb.com (leave empty to auto-derive)" {...register("imapHost")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imapPort">IMAP Port</Label>
                <Input id="imapPort" type="number" {...register("imapPort")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imapEncryption">IMAP Encryption</Label>
                <select 
                  id="imapEncryption" 
                  {...register("imapEncryption")}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="none">None</option>
                  <option value="ssl">SSL</option>
                  <option value="tls">TLS</option>
                </select>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {account ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
