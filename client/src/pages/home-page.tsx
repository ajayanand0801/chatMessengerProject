import { useState } from "react";
import { User } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useChat } from "@/hooks/use-chat";
import { Button } from "@/components/ui/button";
import { UserList } from "@/components/chat/user-list";
import { MessageList } from "@/components/chat/message-list";
import { MessageInput } from "@/components/chat/message-input";
import { LogOut } from "lucide-react";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const { users, sendMessage, getMessages } = useChat();
  const [selectedUser, setSelectedUser] = useState<User>();

  const { data: messages = [] } = getMessages(selectedUser?.id ?? 0);

  const handleSendMessage = (content: string) => {
    if (!selectedUser) return;
    sendMessage.mutate({
      content,
      receiverId: selectedUser.id,
    });
  };

  return (
    <div className="min-h-screen flex">
      <div className="flex flex-col">
        <div className="p-4 bg-card flex items-center justify-between">
          <h1 className="font-semibold">Chat App</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => logoutMutation.mutate()}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        <UserList
          users={users}
          selectedUser={selectedUser}
          onSelectUser={setSelectedUser}
        />
      </div>
      
      {selectedUser ? (
        <div className="flex-1 flex flex-col">
          <div className="p-4 bg-card border-b">
            <h2 className="font-semibold">{selectedUser.username}</h2>
          </div>
          <MessageList messages={messages} selectedUser={selectedUser} />
          <MessageInput
            selectedUser={selectedUser}
            onSendMessage={handleSendMessage}
            isLoading={sendMessage.isPending}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Select a user to start chatting
        </div>
      )}
    </div>
  );
}
