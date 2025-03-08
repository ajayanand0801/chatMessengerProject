
import { Group } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Plus } from "lucide-react";
import { useState } from "react";
import { CreateGroupDialog } from "@/components/group/create-group-dialog";

interface GroupListProps {
  groups: Group[];
  users: any[];
  selectedGroup: Group | null;
  onSelectGroup: (group: Group) => void;
  className?: string;
}

export function GroupList({
  groups,
  users,
  selectedGroup,
  onSelectGroup,
  className,
}: GroupListProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between px-4 py-2">
        <h2 className="text-lg font-semibold">Groups</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowCreateDialog(true)}
          title="Create Group"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>
      
      <div className="space-y-1 px-1">
        {groups.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground text-center">
            No groups yet
          </div>
        ) : (
          groups.map((group) => (
            <Button
              key={group.id}
              variant={selectedGroup?.id === group.id ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => onSelectGroup(group)}
            >
              <div className="flex items-center gap-3 w-full">
                <Avatar>
                  {group.profileImage ? (
                    <AvatarImage src={group.profileImage} alt={group.name} />
                  ) : (
                    <AvatarFallback>
                      <Users className="h-4 w-4" />
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1 min-w-0">
                  <span className="truncate">{group.name}</span>
                </div>
              </div>
            </Button>
          ))
        )}
      </div>
      
      <CreateGroupDialog 
        users={users} 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog} 
      />
    </div>
  );
}
