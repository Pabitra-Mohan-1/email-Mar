import { useState } from "react";
import { useListTemplates, useDeleteTemplate, useDuplicateTemplate } from "@workspace/api-client-react";
import { getListTemplatesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Trash2, Edit2, Plus, Copy, Eye } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { TemplateDialog } from "@/components/forms/template-dialog";
import { TemplatePreviewDialog } from "@/components/forms/template-preview-dialog";

export default function Templates() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);

  const { data: templates, isLoading } = useListTemplates();
  const deleteTemplate = useDeleteTemplate();
  const duplicateTemplate = useDuplicateTemplate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleCreate = () => {
    setEditingTemplate(null);
    setDialogOpen(true);
  };

  const handleEdit = (template: any) => {
    setEditingTemplate(template);
    setDialogOpen(true);
  };

  const handlePreview = (template: any) => {
    setPreviewTemplate(template);
    setPreviewOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      await deleteTemplate.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey() });
      toast({ title: "Template deleted" });
    } catch (e) {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateTemplate.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey() });
      toast({ title: "Template duplicated" });
    } catch (e) {
      toast({ title: "Failed to duplicate template", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Templates</h1>
          <p className="text-muted-foreground mt-1">Design and manage your email content</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Template
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="flex flex-col h-[320px]">
              <div className="h-40 bg-muted flex items-center justify-center border-b">
                <Skeleton className="h-12 w-12 rounded-full" />
              </div>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardFooter className="mt-auto">
                <Skeleton className="h-8 w-full" />
              </CardFooter>
            </Card>
          ))
        ) : templates?.length === 0 ? (
          <div className="col-span-full py-16 text-center text-muted-foreground bg-muted/30 border border-dashed rounded-lg">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-lg font-medium mb-1 text-foreground">No templates yet</p>
            <p>Create your first email template to get started.</p>
            <Button className="mt-6" variant="outline" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </div>
        ) : (
          templates?.map((template) => (
            <Card key={template.id} className="flex flex-col overflow-hidden transition-all hover:shadow-md border-border/50">
              <div className="h-32 bg-secondary/30 relative flex items-center justify-center p-4 overflow-hidden border-b border-border/50">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                <FileText className="h-12 w-12 text-primary/20" />
                
                <div className="absolute top-3 right-3">
                  <Badge variant={template.status === 'active' ? 'default' : 'secondary'} className="shadow-sm">
                    {template.status}
                  </Badge>
                </div>
              </div>
              
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-lg line-clamp-1" title={template.name}>
                  {template.name}
                </CardTitle>
                <CardDescription className="line-clamp-2 text-xs h-8" title={template.subject}>
                  Subject: <span className="font-medium text-foreground">{template.subject}</span>
                </CardDescription>
              </CardHeader>
              
              <CardContent className="text-xs text-muted-foreground pb-4">
                Updated {format(new Date(template.updatedAt || template.createdAt), "MMM d, yyyy")}
              </CardContent>
              
              <div className="mt-auto border-t bg-muted/10 p-2 flex items-center justify-between">
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => handleEdit(template)}>
                    <Edit2 className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20" onClick={() => handlePreview(template)}>
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    Preview
                  </Button>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleDuplicate(template.id)} title="Duplicate">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(template.id)}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <TemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        template={editingTemplate}
      />

      <TemplatePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        template={previewTemplate}
      />
    </div>
  );
}
