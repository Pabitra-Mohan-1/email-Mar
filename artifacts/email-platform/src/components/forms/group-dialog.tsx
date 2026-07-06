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
import { useCreateGroup, useUpdateGroup, getListGroupsQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const groupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

type GroupFormValues = z.infer<typeof groupSchema>;

interface GroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: { id: string; name: string; description?: string | null } | null;
}

export function GroupDialog({ open, onOpenChange, group }: GroupDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (group) {
        reset({ name: group.name, description: group.description || "" });
      } else {
        reset({ name: "", description: "" });
      }
    }
  }, [open, group, reset]);

  const onSubmit = async (data: GroupFormValues) => {
    try {
      if (group) {
        await updateGroup.mutateAsync({ id: group.id, data });
        toast({ title: "Group updated successfully" });
      } else {
        await createGroup.mutateAsync({ data });
        toast({ title: "Group created successfully" });
      }
      queryClient.invalidateQueries({ queryKey: getListGroupsQueryKey() });
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Failed to save group", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{group ? "Edit Group" : "Create Group"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Group Name</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" {...register("description")} />
            {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {group ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
