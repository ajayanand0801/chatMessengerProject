import { User } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function UserList({
  users,
  selectedUser,
  onSelectUser,
}: {
  users: User[];
  selectedUser?: User;
  onSelectUser: (user: User) => void;
}) {
  return (
    <Card className="w-64 h-[calc(100vh-4rem)]">
      <ScrollArea className="h-full p-4">
        <div className="space-y-2">
          {users.map((user) => (
            <Button
              key={user.id}
              variant={selectedUser?.id === user.id ? "default" : "ghost"}
              className={cn("w-full justify-start", {
                "bg-primary text-primary-foreground":
                  selectedUser?.id === user.id,
              })}
              onClick={() => onSelectUser(user)}
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn("w-2 h-2 rounded-full", {
                    "bg-green-500": user.isOnline,
                    "bg-gray-500": !user.isOnline,
                  })}
                />
                <span>{user.username}</span>
              </div>
            </Button>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}
