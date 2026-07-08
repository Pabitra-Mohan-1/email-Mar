import { useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListContactsQueryKey, useListGroups, getListGroupsQueryKey } from "@workspace/api-client-react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X } from "lucide-react";

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId?: string;
}

export function ImportDialog({ open, onOpenChange, groupId }: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [autoSplit, setAutoSplit] = useState(true);
  const [progress, setProgress] = useState<{ imported: number; skipped: number; total: number; percentage: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: groups } = useListGroups();

  useEffect(() => {
    if (open) {
      setSelectedGroupId(groupId || "");
      setAutoSplit(true);
      setProgress(null);
    }
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [open, groupId]);

  const handleFile = (f: File) => {
    setFile(f);
    setResult(null);
    setProgress(null);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setProgress(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (selectedGroupId) formData.append("groupId", selectedGroupId);
      formData.append("autoSplit", String(autoSplit));

      const res = await fetch("/api/contacts/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");

      const jobId = data.jobId;
      if (!jobId) {
        throw new Error("No import Job ID returned");
      }

      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/contacts/import/status/${jobId}`);
          if (!statusRes.ok) throw new Error("Failed to fetch import status");
          const statusData = await statusRes.json();

          const processed = statusData.imported + statusData.skipped;
          const pct = statusData.total > 0 ? Math.round((processed / statusData.total) * 100) : 0;

          setProgress({
            imported: statusData.imported,
            skipped: statusData.skipped,
            total: statusData.total,
            percentage: Math.min(pct, 100)
          });

          if (statusData.status === "completed" || statusData.status === "failed") {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
            }
            setLoading(false);

            if (statusData.status === "failed") {
              throw new Error(statusData.error || "Import failed during background processing");
            }

            setResult({
              imported: statusData.imported,
              skipped: statusData.skipped,
              errors: statusData.errors || [],
            });

            queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getListGroupsQueryKey() });
            toast({ title: `Imported ${statusData.imported} contacts successfully` });
          }
        } catch (err) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          setLoading(false);
          setProgress(null);
          toast({
            title: "Import failed",
            description: err instanceof Error ? err.message : String(err),
            variant: "destructive",
          });
        }
      }, 500);

    } catch (err: unknown) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    setFile(null);
    setResult(null);
    setProgress(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Contacts from Excel / CSV</DialogTitle>
          <DialogDescription>
            Upload an Excel (.xlsx) or CSV file. Columns detected automatically:
            <span className="font-medium"> Name, Email, Company, Mobile/Phone</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4">
          {/* Progress bar */}
          {loading && progress && (
            <div className="space-y-3 py-4">
              <div className="flex justify-between items-center text-sm font-medium">
                <span className="text-primary animate-pulse flex items-center gap-2">
                  <span className="h-2 w-2 bg-primary rounded-full animate-ping" />
                  Importing contacts...
                </span>
                <span className="text-primary font-bold">{progress.percentage}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3.5 overflow-hidden border border-border">
                <div
                  className="bg-primary h-full transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground flex justify-between">
                <span>Processed: {progress.imported + progress.skipped} / {progress.total} contacts</span>
                <span>Skipped/Duplicates: {progress.skipped}</span>
              </div>
            </div>
          )}

          {/* Initial loading placeholder */}
          {loading && !progress && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <span className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium text-muted-foreground">Uploading and parsing file...</p>
            </div>
          )}

          {/* Group Selection */}
          {!result && !loading && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Assign Imported Contacts to Group</label>
                <select
                  value={selectedGroupId}
                  disabled={autoSplit}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                >
                  <option value="">-- No Group (Import as General Contacts) --</option>
                  {groups?.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="auto-split-checkbox"
                  checked={autoSplit}
                  onChange={(e) => setAutoSplit(e.target.checked)}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-ring focus:ring-1 focus:outline-none cursor-pointer"
                />
                <label htmlFor="auto-split-checkbox" className="text-sm font-medium text-muted-foreground select-none cursor-pointer">
                  Auto-split into groups of 500 contacts
                </label>
              </div>
            </div>
          )}

          {/* Drop zone */}
          {!result && !loading && (
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                dragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileSpreadsheet className="h-10 w-10 text-primary" />
                  <p className="font-medium text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB · Click to change
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="h-10 w-10" />
                  <p className="font-medium">Drop your Excel or CSV file here</p>
                  <p className="text-xs">or click to browse — max 20 MB</p>
                </div>
              )}
            </div>
          )}

          {/* Column format hint */}
          {!result && !loading && (
            <div className="rounded-md bg-muted/50 border px-4 py-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground/80 mb-1">Expected column headers (any order):</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                <span><span className="font-mono bg-background border rounded px-1">Name</span> — contact name</span>
                <span><span className="font-mono bg-background border rounded px-1">Email</span> — required</span>
                <span><span className="font-mono bg-background border rounded px-1">Company</span> — company name</span>
                <span><span className="font-mono bg-background border rounded px-1">Mobile</span> — phone number</span>
              </div>
            </div>
          )}

          {/* Import result */}
          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-800 dark:text-emerald-400">
                    {result.imported} contacts imported
                  </p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-500">
                    {result.skipped} rows skipped (duplicates or invalid)
                  </p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Row errors:</p>
                  </div>
                  <ul className="text-xs text-amber-700 dark:text-amber-500 space-y-0.5 max-h-32 overflow-y-auto">
                    {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            {result ? <><X className="h-4 w-4 mr-1" /> Close</> : "Cancel"}
          </Button>
          {!result && !loading && (
            <Button onClick={handleImport} disabled={!file || loading}>
              <><Upload className="h-4 w-4 mr-2" /> Import</>
            </Button>
          )}
          {result && (
            <Button onClick={() => { setFile(null); setResult(null); setProgress(null); }}>
              Import another file
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
