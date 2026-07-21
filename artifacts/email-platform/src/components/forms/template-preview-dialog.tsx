import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TemplatePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: any;
}

export function TemplatePreviewDialog({ open, onOpenChange, template }: TemplatePreviewDialogProps) {
  if (!template) return null;

  // Simple placeholder replacement for preview
  const previewHtml = (template.htmlContent || "")
    .replace(/\{\{name\}\}/gi, "John Doe")
    .replace(/\[\[NAME\]\]/gi, "John Doe")
    .replace(/\{\{email\}\}/gi, "john.doe@example.com")
    .replace(/\{\{company\}\}/gi, "example.com")
    .replace(/\{\{domain\}\}/gi, "example.com")
    .replace(/\[\[DOMAIN\]\]/g, "example.com")
    .replace(/\{\{senderName\}\}/gi, "Marketing Consultant")
    .replace(/\{\{sender_name\}\}/gi, "Marketing Consultant")
    .replace(/\[\[SENDER_NAME\]\]/gi, "Marketing Consultant")
    .replace(/\bNAME\b/g, "Marketing Consultant");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader className="pb-2 border-b">
          <DialogTitle className="text-xl">Preview: {template.name}</DialogTitle>
          <div className="text-xs text-muted-foreground mt-1 space-y-1">
            <div>
              <span className="font-semibold">Subject:</span> {template.subject}
            </div>
            {template.previewText && (
              <div>
                <span className="font-semibold">Preheader Text:</span> {template.previewText}
              </div>
            )}
          </div>
        </DialogHeader>
        <div className="flex-1 border rounded-md bg-white overflow-hidden mt-4">
          <iframe 
            title="Email Template Preview"
            srcDoc={previewHtml}
            className="w-full h-full border-0 bg-white"
            sandbox="allow-same-origin"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
