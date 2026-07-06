import { useState } from "react";
import { 
  useListContacts, 
  useListGroups, 
  useDeleteContact,
  useCreateContact,
  useUpdateContact
} from "@workspace/api-client-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  Search, Plus, Trash2, Edit2, ChevronLeft, ChevronRight, FolderHeart, Upload, AlertTriangle, Download
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListContactsQueryKey } from "@workspace/api-client-react";
import { ContactDialog } from "@/components/forms/contact-dialog";
import { ImportDialog } from "@/components/forms/import-dialog";
import { GroupDialog } from "@/components/forms/group-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function Contacts() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [groupId, setGroupId] = useState<string | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);

  const limit = 20;

  const { data: contactsData, isLoading } = useListContacts({
    search: search || undefined,
    groupId,
    page,
    limit,
  });

  const { data: groups } = useListGroups();
  const deleteContact = useDeleteContact();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleCreate = () => {
    setEditingContact(null);
    setDialogOpen(true);
  };

  const handleEdit = (contact: any) => {
    setEditingContact(contact);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this contact?")) return;
    try {
      await deleteContact.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
      toast({ title: "Contact deleted" });
    } catch (e) {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const handleDeleteAll = async () => {
    setDeletingAll(true);
    try {
      const res = await fetch("/api/contacts/all", { method: "DELETE" });
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
      setDeleteAllOpen(false);
      setPage(1);
      toast({ title: `Deleted ${data.deleted} contacts` });
    } catch {
      toast({ title: "Failed to delete all contacts", variant: "destructive" });
    } finally {
      setDeletingAll(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch(`/api/contacts?limit=50000${groupId ? `&groupId=${groupId}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch contacts for export");
      const data = await res.json();
      
      const contacts = data.contacts;
      if (!contacts || contacts.length === 0) {
        toast({ title: "No contacts to export", variant: "destructive" });
        return;
      }

      // Build CSV
      const headers = ["Name", "Email", "Company", "Mobile", "City", "Country", "Status", "Created At"];
      const rows = contacts.map((c: any) => [
        `"${(c.name || "").replace(/"/g, '""')}"`,
        `"${(c.email || "").replace(/"/g, '""')}"`,
        `"${(c.company || "").replace(/"/g, '""')}"`,
        `"${(c.mobile || "").replace(/"/g, '""')}"`,
        `"${(c.city || "").replace(/"/g, '""')}"`,
        `"${(c.country || "").replace(/"/g, '""')}"`,
        c.isActive ? "Active" : "Inactive",
        c.createdAt
      ]);

      const csvContent = [headers.join(","), ...rows.map((r: any[]) => r.join(","))].join("\n");
      
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      
      // Name CSV file based on the active group
      const activeGroupName = groupId ? groups?.find(g => g.id === groupId)?.name : "all";
      link.setAttribute("download", `contacts_${activeGroupName}_export_${Date.now()}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({ title: "Contacts exported successfully" });
    } catch (err) {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden gap-6">
      {/* Sidebar for Groups */}
      <div className="w-64 flex-shrink-0 border-r pr-6 flex flex-col hidden md:flex">
        <div className="font-semibold mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderHeart className="h-4 w-4" />
            Groups
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 text-muted-foreground hover:text-foreground" 
            onClick={() => setGroupDialogOpen(true)}
            title="Create Group"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-1 overflow-y-auto">
          <button
            onClick={() => { setGroupId(undefined); setPage(1); }}
            className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${!groupId ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"}`}
          >
            All Contacts
          </button>
          {groups?.map(group => (
            <button
              key={group.id}
              onClick={() => { setGroupId(group.id); setPage(1); }}
              className={`w-full text-left px-3 py-2 text-sm rounded-md flex justify-between items-center transition-colors ${groupId === group.id ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"}`}
            >
              <span className="truncate">{group.name}</span>
              <span className="text-xs opacity-70">{group.contactCount || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setDeleteAllOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete All
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import Excel
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Contact
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        <div className="border rounded-md flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : contactsData?.contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    No contacts found
                  </TableCell>
                </TableRow>
              ) : (
                contactsData?.contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">{contact.name || "-"}</TableCell>
                    <TableCell>{contact.email}</TableCell>
                    <TableCell>{contact.company || "-"}</TableCell>
                    <TableCell>
                      {contact.city || contact.country ? 
                        [contact.city, contact.country].filter(Boolean).join(", ") 
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {contact.isActive ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(contact.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(contact)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(contact.id)}
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

        {/* Pagination */}
        {contactsData && contactsData.total > limit && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, contactsData.total)} of {contactsData.total} entries
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
                disabled={page * limit >= contactsData.total}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <ContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contact={editingContact}
      />
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        groupId={groupId}
      />
      <GroupDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
      />

      {/* Delete All Confirmation */}
      <Dialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete All Contacts
            </DialogTitle>
            <DialogDescription>
              This will permanently delete{" "}
              <span className="font-semibold text-foreground">
                {contactsData?.total ?? "all"} contacts
              </span>{" "}
              from your database. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteAllOpen(false)} disabled={deletingAll}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAll} disabled={deletingAll}>
              {deletingAll ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Deleting…
                </span>
              ) : (
                <><Trash2 className="h-4 w-4 mr-2" /> Delete All</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
