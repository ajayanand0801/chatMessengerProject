import { User } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function UserList({
  users,
  selectedUser,
  onSelectUser,
  typingUsers,
}: {
  users: (User & { unreadCount?: number })[];
  selectedUser?: User;
  onSelectUser: (user: User) => void;
  typingUsers?: Set<number>;
}) {
  return (
    <Card className="w-64 h-[calc(100vh-4rem)] bg-white/50 backdrop-blur-sm">
      <ScrollArea className="h-full p-4">
        <div className="space-y-2">
          {users.map((user) => (
            <Button
              key={user.id}
              variant={selectedUser?.id === user.id ? "default" : "ghost"}
              className={cn("w-full justify-start relative", {
                "bg-primary text-primary-foreground": selectedUser?.id === user.id,
              })}
              onClick={() => onSelectUser(user)}
            >
              <div className="flex items-center gap-3 w-full">
                <Avatar>
                  {user.profileImage ? (
                    <AvatarImage src={user.profileImage} alt={user.username} />
                  ) : (
                    <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1 min-w-0">
                  <span className="truncate">{user.username}</span>
                  {typingUsers?.has(user.id) && (
                    <span className="text-xs italic text-muted-foreground block">
                      typing...
                    </span>
                  )}
                </div>
                {user.unreadCount && user.unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute top-1 right-1"
                  >
                    {user.unreadCount}
                  </Badge>
                )}
              </div>
            </Button>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}