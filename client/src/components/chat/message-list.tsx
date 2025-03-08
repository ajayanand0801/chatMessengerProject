import { Message, User } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";

export function MessageList({
  messages,
  selectedUser,
}: {
  messages: Message[];
  selectedUser: User;
}) {
  const { user } = useAuth();

  return (
    <ScrollArea className="h-[calc(100vh-12rem)] p-4">
      <div className="space-y-4">
        {messages.map((message) => {
          const isOwnMessage = message.senderId === user?.id;
          return (
            <div
              key={message.id}
              className={cn("flex", {
                "justify-end": isOwnMessage,
              })}
            >
              <Card
                className={cn(
                  "p-4 max-w-[80%] shadow-sm",
                  isOwnMessage
                    ? "bg-primary text-primary-foreground"
                    : "bg-white"
                )}
              >
                <div className="flex flex-col gap-1">
                  <span className={cn(
                    "text-xs font-medium",
                    isOwnMessage ? "text-primary-foreground/80" : "text-muted-foreground"
                  )}>
                    {isOwnMessage ? "You" : selectedUser.username}
                  </span>
                  <p className="text-sm">{message.content}</p>
                  <span className={cn(
                    "text-xs",
                    isOwnMessage ? "text-primary-foreground/60" : "text-muted-foreground/60"
                  )}>
                    {format(new Date(message.createdAt), "h:mm a")}
                  </span>
                </div>
              </Card>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}