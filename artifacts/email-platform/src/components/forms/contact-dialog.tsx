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
import { Checkbox } from "@/components/ui/checkbox";
import { useCreateContact, useUpdateContact, getListContactsQueryKey, useListGroups } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const contactSchema = z.object({
  name: z.string().optional(),
  email: z.string().email("Valid email is required"),
  company: z.string().optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  groupIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

type ContactFormValues = z.infer<typeof contactSchema>;

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: any;
}

export function ContactDialog({ open, onOpenChange, contact }: ContactDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const { data: groups } = useListGroups();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      company: "",
      phone: "",
      city: "",
      country: "",
      groupIds: [],
      isActive: true,
    },
  });

  const selectedGroups = watch("groupIds") || [];

  useEffect(() => {
    if (open) {
      if (contact) {
        reset({ 
          name: contact.name || "",
          email: contact.email,
          company: contact.company || "",
          phone: contact.phone || "",
          city: contact.city || "",
          country: contact.country || "",
          groupIds: contact.groupIds || [],
          isActive: contact.isActive ?? true,
        });
      } else {
        reset({
          name: "",
          email: "",
          company: "",
          phone: "",
          city: "",
          country: "",
          groupIds: [],
          isActive: true,
        });
      }
    }
  }, [open, contact, reset]);

  const onSubmit = async (data: ContactFormValues) => {
    try {
      if (contact) {
        await updateContact.mutateAsync({ id: contact.id, data });
        toast({ title: "Contact updated successfully" });
      } else {
        await createContact.mutateAsync({ data });
        toast({ title: "Contact created successfully" });
      }
      queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Failed to save contact", variant: "destructive" });
    }
  };

  const handleGroupToggle = (groupId: string, checked: boolean) => {
    if (checked) {
      setValue("groupIds", [...selectedGroups, groupId]);
    } else {
      setValue("groupIds", selectedGroups.filter(id => id !== groupId));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit Contact" : "Add Contact"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" {...register("name")} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address <span className="text-destructive">*</span></Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input id="company" {...register("company")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" {...register("phone")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" {...register("city")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input id="country" {...register("country")} />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <Label>Contact Groups</Label>
            <div className="grid grid-cols-2 gap-2 mt-2 max-h-32 overflow-y-auto">
              {groups?.map(group => (
                <div key={group.id} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`group-${group.id}`} 
                    checked={selectedGroups.includes(group.id)}
                    onCheckedChange={(checked) => handleGroupToggle(group.id, checked as boolean)}
                  />
                  <Label htmlFor={`group-${group.id}`} className="font-normal cursor-pointer text-sm">
                    {group.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2 border-t">
            <Checkbox 
              id="isActive" 
              checked={watch("isActive")}
              onCheckedChange={(checked) => setValue("isActive", checked as boolean)}
            />
            <Label htmlFor="isActive" className="font-medium cursor-pointer">
              Active subscriber (can receive emails)
            </Label>
          </div>
          
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {contact ? "Save Changes" : "Create Contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
