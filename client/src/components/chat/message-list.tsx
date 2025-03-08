import { Message, User } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

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
        {messages.map((message) => (
          <Card
            key={message.id}
            className={cn(
              "p-4 max-w-[80%]",
              message.senderId === user?.id
                ? "ml-auto bg-primary text-primary-foreground"
                : "bg-muted"
            )}
          >
            <p className="text-sm">{message.content}</p>
            <span className="text-xs opacity-70">
              {new Date(message.createdAt).toLocaleTimeString()}
            </span>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
