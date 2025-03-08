
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User } from "@shared/schema";
import { Check, X, Users, Upload } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface CreateGroupDialogProps {
  users: User[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateGroupDialog({ users, open, onOpenChange }: CreateGroupDialogProps) {
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupImage, setGroupImage] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleUserSelection = (userId: number) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  const createGroup = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: groupName,
          members: selectedUsers,
          profileImage: groupImage,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create group");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({
        title: "Group created",
        description: `${groupName} has been created successfully.`,
      });
      handleClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create group: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload file");
      }

      const data = await response.json();
      setGroupImage(data.url);
    } catch (error) {
      console.error("Error uploading file:", error);
      toast({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setGroupName("");
    setSelectedUsers([]);
    setSearchQuery("");
    setGroupImage(null);
    onOpenChange(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!groupName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a group name",
        variant: "destructive",
      });
      return;
    }
    
    if (selectedUsers.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one user",
        variant: "destructive",
      });
      return;
    }
    
    createGroup.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Group</DialogTitle>
            <DialogDescription>
              Create a group chat with multiple users
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="group-image" className="text-right">
                Image
              </Label>
              <div className="col-span-3 flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  {groupImage ? (
                    <AvatarImage src={groupImage} alt="Group image" />
                  ) : (
                    <AvatarFallback>
                      <Users className="h-6 w-6" />
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="relative">
                  <Input
                    id="group-image"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={() => document.getElementById("group-image")?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    Upload
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="group-name" className="text-right">
                Name
              </Label>
              <Input
                id="group-name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="col-span-3"
                placeholder="Enter group name"
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="search-users" className="text-right pt-2">
                Members
              </Label>
              <div className="col-span-3 space-y-4">
                <Input
                  id="search-users"
                  placeholder="Search users"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="h-[180px] overflow-y-auto border rounded-md p-2 space-y-2">
                  {filteredUsers.length === 0 ? (
                    <div className="text-center text-muted-foreground py-4">
                      No users found
                    </div>
                  ) : (
                    filteredUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-2 hover:bg-accent rounded-md cursor-pointer"
                        onClick={() => toggleUserSelection(user.id)}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            {user.profileImage ? (
                              <AvatarImage src={user.profileImage} alt={user.username} />
                            ) : (
                              <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
                            )}
                          </Avatar>
                          <span>{user.username}</span>
                        </div>
                        {selectedUsers.includes(user.id) ? (
                          <Check className="h-5 w-5 text-primary" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
                        )}
                      </div>
                    ))
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedUsers.length} users selected
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createGroup.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createGroup.isPending || !groupName.trim() || selectedUsers.length === 0}
            >
              {createGroup.isPending ? "Creating..." : "Create Group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
