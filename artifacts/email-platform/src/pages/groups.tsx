import { useState } from "react";
import { useListGroups, useDeleteGroup } from "@workspace/api-client-react";
import { getListGroupsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Trash2, Edit2, Plus, FolderHeart } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { GroupDialog } from "@/components/forms/group-dialog";

export default function Groups() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any>(null);

  const { data: groups, isLoading } = useListGroups();
  const deleteGroup = useDeleteGroup();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleCreate = () => {
    setEditingGroup(null);
    setDialogOpen(true);
  };

  const handleEdit = (group: any) => {
    setEditingGroup(group);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this group? Contacts in the group will not be deleted.")) return;
    try {
      await deleteGroup.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListGroupsQueryKey() });
      toast({ title: "Group deleted" });
    } catch (e) {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contact Groups</h1>
          <p className="text-muted-foreground mt-1">Organize your contacts into segments</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Group
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-1/3" />
              </CardContent>
            </Card>
          ))
        ) : groups?.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/30 border border-dashed rounded-lg">
            <FolderHeart className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p>No groups created yet.</p>
          </div>
        ) : (
          groups?.map((group) => (
            <Card key={group.id} className="group relative overflow-hidden transition-all hover:shadow-md">
              <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(group)}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(group.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="pr-12 truncate">{group.name}</CardTitle>
                {group.description && (
                  <CardDescription className="line-clamp-2 min-h-[40px]">
                    {group.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
                <div className="flex items-center text-muted-foreground">
                  <Users className="h-4 w-4 mr-2" />
                  <span className="font-medium text-foreground">{group.contactCount || 0}</span>
                  <span className="ml-1">contacts</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(group.createdAt), "MMM d, yyyy")}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <GroupDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
        group={editingGroup} 
      />
    </div>
  );
}
