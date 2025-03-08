import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface CreateGroupDialogProps {
  users: any[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateGroupDialog({ users, open, onOpenChange }: CreateGroupDialogProps) {
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [groupName, setGroupName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createGroup = useMutation({
    mutationFn: async ({ name, members }: { name: string; members: number[] }) => {
      console.log("Creating group:", { name, members });

      const res = await fetch("/api/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          name, 
          members: Array.isArray(members) ? members : [] 
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Server response:", errorData);
        throw new Error(errorData.message || 'Failed to create group');
      }

      const data = await res.json();
      console.log("Group created successfully:", data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({
        title: "Group created!",
        description: "Your new group has been created successfully.",
      });
      onOpenChange(false);
      setSelectedUsers([]);
      setGroupName("");
    },
    onError: (error: any) => {
      console.error("Group creation error:", error);
      toast({
        title: "Failed to create group",
        description: error.message || "An error occurred while creating the group.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName) {
      toast({
        title: "Group name required",
        description: "Please enter a name for your group.",
        variant: "destructive",
      });
      return;
    }

    await createGroup.mutateAsync({ name: groupName, members: selectedUsers });

  };

  const toggleUser = (userId: number) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Group</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Group Name</Label>
            <Input
              id="name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Enter group name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Select Members</Label>
            <div className="max-h-60 overflow-y-auto space-y-2 border rounded-md p-2">
              {users.length === 0 ? (
                <div className="text-sm text-muted-foreground p-2 text-center">
                  No users available
                </div>
              ) : (
                users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center space-x-2 p-2 hover:bg-accent rounded-md"
                  >
                    <Checkbox
                      id={`user-${user.id}`}
                      checked={selectedUsers.includes(user.id)}
                      onCheckedChange={() => toggleUser(user.id)}
                    />
                    <Label
                      htmlFor={`user-${user.id}`}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Avatar className="h-8 w-8">
                        {user.profileImage ? (
                          <AvatarImage src={user.profileImage} alt={user.username} />
                        ) : (
                          <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                        )}
                      </Avatar>
                      <span>{user.username}</span>
                    </Label>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" >
              Create Group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}