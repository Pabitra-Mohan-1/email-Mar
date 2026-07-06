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
import { Textarea } from "@/components/ui/textarea";
import { useCreateTemplate, useUpdateTemplate, getListTemplatesQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { EmailTemplateInputStatus } from "@workspace/api-client-react";

const templateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  subject: z.string().min(1, "Subject is required"),
  previewText: z.string().optional(),
  htmlContent: z.string().min(1, "HTML content is required"),
  status: z.nativeEnum(EmailTemplateInputStatus).optional(),
});

type TemplateFormValues = z.infer<typeof templateSchema>;

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: any;
}

export function TemplateDialog({ open, onOpenChange, template }: TemplateDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: "",
      subject: "",
      previewText: "",
      htmlContent: "",
      status: "draft",
    },
  });

  useEffect(() => {
    if (open) {
      if (template) {
        reset({ 
          name: template.name, 
          subject: template.subject,
          previewText: template.previewText || "",
          htmlContent: template.htmlContent || "",
          status: template.status || "draft",
        });
      } else {
        reset({ 
          name: "", 
          subject: "",
          previewText: "",
          htmlContent: "",
          status: "draft",
        });
      }
    }
  }, [open, template, reset]);

  const onSubmit = async (data: TemplateFormValues) => {
    try {
      if (template) {
        await updateTemplate.mutateAsync({ id: template.id, data });
        toast({ title: "Template updated successfully" });
      } else {
        await createTemplate.mutateAsync({ data });
        toast({ title: "Template created successfully" });
      }
      queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey() });
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Failed to save template", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{template ? "Edit Template" : "Create Template"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Internal Name</Label>
              <Input id="name" {...register("name")} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select 
                id="status" 
                {...register("status")}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
              </select>
              {errors.status && <p className="text-sm text-destructive">{errors.status.message}</p>}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="subject">Email Subject</Label>
            <Input id="subject" {...register("subject")} />
            {errors.subject && <p className="text-sm text-destructive">{errors.subject.message}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="previewText">Preview Text (Snippet)</Label>
            <Input id="previewText" {...register("previewText")} />
            {errors.previewText && <p className="text-sm text-destructive">{errors.previewText.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="htmlContent">HTML Content</Label>
            <Textarea 
              id="htmlContent" 
              {...register("htmlContent")} 
              className="font-mono h-48 resize-y"
              placeholder="<html><body>...</body></html>"
            />
            {errors.htmlContent && <p className="text-sm text-destructive">{errors.htmlContent.message}</p>}
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {template ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
