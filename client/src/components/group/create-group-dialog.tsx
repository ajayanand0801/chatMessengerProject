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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const createGroupMutation = useMutation({
    mutationFn: async (data: { name: string; members: number[] }) => {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create group");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({
        title: "Group created",
        description: "Your new group has been created successfully.",
      });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      console.error("Error creating group:", error);
      toast({
        title: "Error creating group",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setName("");
    setSelectedUsers([]);
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      toast({
        title: "Group name required",
        description: "Please enter a name for the group.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await createGroupMutation.mutateAsync({
        name,
        members: selectedUsers,
      });
    } catch (error) {
      // Error is handled by the mutation
    } finally {
      setIsLoading(false);
    }
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
              value={name}
              onChange={(e) => setName(e.target.value)}
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
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Group"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}