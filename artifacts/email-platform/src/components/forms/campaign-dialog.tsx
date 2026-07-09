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
import { 
  useCreateCampaign, 
  useUpdateCampaign,
  getListCampaignsQueryKey, 
  useListGroups,
  useListTemplates,
  useListSmtpAccounts
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { isoToISTInput, istInputToISO } from "@/lib/datetime";

const campaignSchema = z.object({
  name: z.string().min(1, "Name is required"),
  subject: z.string().min(1, "Subject is required"),
  senderName: z.string().min(1, "Sender name is required"),
  senderEmail: z.string().email("Valid email is required"),
  smtpAccountId: z.string().optional(),
  templateId: z.string().optional(),
  groupId: z.string().min(1, "Target contact group is required"),
  scheduledAt: z.string().optional(),
  mailsPerBatch: z.coerce.number().min(1, "Must send at least 1 mail per batch").default(500),
  intervalMinutes: z.coerce.number().min(1, "Interval must be at least 1 minute").default(1),
  customHtml: z.string().optional(),
});

type CampaignFormValues = z.infer<typeof campaignSchema>;

interface CampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign?: any;
}

export function CampaignDialog({ open, onOpenChange, campaign }: CampaignDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();

  const [isEditingHtml, setIsEditingHtml] = useState(false);

  const { data: groups } = useListGroups();
  const { data: templates } = useListTemplates();
  const { data: smtpAccounts } = useListSmtpAccounts();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: "",
      subject: "",
      senderName: "",
      senderEmail: "",
      smtpAccountId: "",
      templateId: "",
      groupId: "",
      scheduledAt: "",
      mailsPerBatch: 500,
      intervalMinutes: 1,
      customHtml: "",
    },
  });

  const selectedTemplateId = watch("templateId");
  const selectedSmtpAccountId = watch("smtpAccountId");
  const customHtmlValue = watch("customHtml");

  // Find currently active template
  const activeTemplate = templates?.find(t => t.id === selectedTemplateId);
  // Find currently active SMTP account
  const activeSmtp = smtpAccounts?.find(s => s.id === selectedSmtpAccountId);

  // Auto-populate template subject and html when template changes
  useEffect(() => {
    if (activeTemplate && !campaign) {
      setValue("subject", activeTemplate.subject || "");
      setValue("customHtml", activeTemplate.htmlContent || "");
    }
  }, [activeTemplate, setValue, campaign]);

  // Auto-populate sender name/email when SMTP account is selected
  useEffect(() => {
    if (activeSmtp && !campaign) {
      setValue("senderEmail", activeSmtp.username || "");
      setValue("senderName", activeSmtp.name || "");
    }
  }, [activeSmtp, setValue, campaign]);

  useEffect(() => {
    if (open) {
      setIsEditingHtml(false);
      if (campaign) {
        reset({
          name: campaign.name,
          subject: campaign.subject,
          senderName: campaign.senderName,
          senderEmail: campaign.senderEmail,
          smtpAccountId: campaign.smtpAccountId || "",
          templateId: campaign.templateId || "",
          groupId: campaign.groupId || "",
          scheduledAt: campaign.scheduledAt ? isoToISTInput(campaign.scheduledAt) : "",
          mailsPerBatch: campaign.mailsPerBatch ?? 500,
          intervalMinutes: campaign.intervalMinutes ?? 1,
          customHtml: campaign.customHtml || "",
        });
      } else {
        reset({
          name: "",
          subject: "",
          senderName: "",
          senderEmail: "",
          smtpAccountId: "",
          templateId: "",
          groupId: "",
          scheduledAt: "",
          mailsPerBatch: 500,
          intervalMinutes: 1,
          customHtml: "",
        });
      }
    }
  }, [open, campaign, reset]);

  const onSubmit = async (data: CampaignFormValues) => {
    try {
      const payload: any = { ...data };
      if (!payload.smtpAccountId) payload.smtpAccountId = null;
      if (!payload.templateId) payload.templateId = null;
      if (!payload.groupId) payload.groupId = null;
      // The datetime-local input yields a timezone-less string (e.g.
      // "2026-07-15T14:30"). We interpret it as IST and convert to a UTC ISO
      // string, so the stored instant is correct on any browser timezone.
      payload.scheduledAt = payload.scheduledAt ? istInputToISO(payload.scheduledAt) : null;

      if (campaign) {
        await updateCampaign.mutateAsync({ id: campaign.id, data: payload });
        toast({ title: "Campaign updated successfully" });
      } else {
        await createCampaign.mutateAsync({ data: payload });
        toast({ title: "Campaign created successfully" });
      }
      queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
      onOpenChange(false);
    } catch (e) {
      toast({ title: campaign ? "Failed to update campaign" : "Failed to create campaign", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campaign ? "Edit Campaign" : "Create Campaign"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          
          {/* Step 1: Select Email Template */}
          <div className="space-y-2">
            <Label htmlFor="templateId">Email Template</Label>
            <select 
              id="templateId" 
              {...register("templateId")}
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">Select a template...</option>
              {templates?.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Email Subject (auto-filled from Template) */}
          <div className="space-y-2">
            <Label htmlFor="subject">Email Subject</Label>
            <Input id="subject" {...register("subject")} placeholder="Enter email subject line" />
            {errors.subject && <p className="text-sm text-destructive">{errors.subject.message}</p>}
          </div>

          {/* Mail Preview & Editing Frame (only if a template is selected) */}
          {(activeTemplate || customHtmlValue) && (
            <div className="space-y-2 border rounded-md p-3 bg-slate-50 dark:bg-slate-900/30">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mail Preview</Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  className="h-7 px-2 text-xs" 
                  onClick={() => setIsEditingHtml(!isEditingHtml)}
                >
                  {isEditingHtml ? "View Preview" : "Edit Template"}
                </Button>
              </div>
              
              {isEditingHtml ? (
                <textarea
                  className="w-full h-[250px] p-2 text-xs font-mono border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={customHtmlValue || ""}
                  onChange={(e) => setValue("customHtml", e.target.value)}
                />
              ) : (
                <div className="h-[250px] border rounded bg-white overflow-hidden shadow-sm">
                  <iframe
                    title="Campaign Template Live Preview"
                    srcDoc={customHtmlValue || activeTemplate?.htmlContent || ""}
                    className="w-full h-full border-0 bg-white"
                    sandbox="allow-same-origin"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 2: Campaign Name (Internal) */}
          <div className="space-y-2">
            <Label htmlFor="name">Campaign Name (Internal Reference)</Label>
            <Input id="name" {...register("name")} placeholder="e.g. June Digital Marketing Outreach" />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          {/* Step 3: Sender Configuration (SMTP Selection) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="smtpAccountId">SMTP Account (Sender)</Label>
              <select 
                id="smtpAccountId" 
                {...register("smtpAccountId")}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Select an account...</option>
                {smtpAccounts?.map(account => (
                  <option key={account.id} value={account.id}>{account.name} ({account.host})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="senderName">Sender Display Name</Label>
                <Input id="senderName" {...register("senderName")} placeholder="e.g. Acme Corp" />
                {errors.senderName && <p className="text-sm text-destructive">{errors.senderName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="senderEmail">Sender Email Address</Label>
                <Input id="senderEmail" {...register("senderEmail")} placeholder="hello@acme.com" />
                {errors.senderEmail && <p className="text-sm text-destructive">{errors.senderEmail.message}</p>}
              </div>
            </div>
          </div>

          {/* Step 4: Target Group & Schedule */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="groupId">Target Contact Group *</Label>
              <select
                id="groupId"
                {...register("groupId")}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Select a group...</option>
                {groups?.map(group => (
                  <option key={group.id} value={group.id}>{group.name} ({group.contactCount} contacts)</option>
                ))}
              </select>
              {errors.groupId && <p className="text-sm text-destructive">{errors.groupId.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduledAt">Schedule For (IST, Optional)</Label>
              <Input id="scheduledAt" type="datetime-local" {...register("scheduledAt")} />
            </div>
          </div>

          {/* Step 5: Customizable Pacing Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="mailsPerBatch">Mails Count (Per Batch)</Label>
              <Input id="mailsPerBatch" type="number" {...register("mailsPerBatch")} min="1" placeholder="e.g. 10" />
              {errors.mailsPerBatch && <p className="text-sm text-destructive">{errors.mailsPerBatch.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="intervalMinutes">Interval (Per Minutes)</Label>
              <Input id="intervalMinutes" type="number" {...register("intervalMinutes")} min="1" placeholder="e.g. 1" />
              {errors.intervalMinutes && <p className="text-sm text-destructive">{errors.intervalMinutes.message}</p>}
            </div>
          </div>
          
          <DialogFooter className="pt-4 mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {campaign ? "Save Changes" : "Create Campaign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
