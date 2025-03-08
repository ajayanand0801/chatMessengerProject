import { useState, useEffect } from "react";
import { User } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useChat } from "@/hooks/use-chat";
import { Button } from "@/components/ui/button";
import { UserList } from "@/components/chat/user-list";
import { MessageList } from "@/components/chat/message-list";
import { MessageInput } from "@/components/chat/message-input";
import { LogOut } from "lucide-react";
import { ProfileImage } from "@/components/profile/profile-image";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const { users, sendMessage, getMessages, typingUsers, sendTypingStatus, editMessage, deleteMessage, deleteChatHistory } = useChat();
  const [selectedUser, setSelectedUser] = useState<User>();

  const { data: messages = [] } = getMessages(selectedUser?.id ?? 0);

  const handleSendMessage = (content: string, attachmentUrl?: string) => {
    if (!selectedUser) return;
    sendMessage.mutate({
      content,
      receiverId: selectedUser.id,
      attachmentUrl,
    });
  };

  const handleTyping = (isTyping: boolean) => {
    if (!selectedUser) return;
    sendTypingStatus(selectedUser.id, isTyping);
  };

  const handleEditMessage = (messageId: number, content: string) => {
    if (!selectedUser) return;
    editMessage.mutate({
      messageId,
      content,
      receiverId: selectedUser.id,
    });
  };

  const handleDeleteMessage = (messageId: number) => {
    if (!selectedUser) return;
    deleteMessage.mutate({
      messageId,
      receiverId: selectedUser.id,
    });
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-primary/5 to-primary/10">
      <div className="flex flex-col">
        <div className="p-4 bg-white/50 backdrop-blur-sm border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ProfileImage user={user!} showUpload size="md" />
            <div className="flex flex-col">
              <h1 className="font-semibold text-primary">{user?.username}</h1>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-muted-foreground">Online</span>
              </div>
            </div>
          </div>
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
          typingUsers={typingUsers}
        />
      </div>

      {selectedUser ? (
        <div className="flex-1 flex flex-col bg-white/50 backdrop-blur-sm">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    selectedUser.isOnline ? "bg-emerald-500" : "bg-gray-300"
                  }`}
                />
                <h2 className="font-semibold text-primary">{selectedUser.username}</h2>
                {typingUsers?.has(selectedUser.id) && (
                  <span className="text-xs italic text-muted-foreground">
                    typing...
                  </span>
                )}
              </div>
              <Button 
                variant="outline" 
                size="sm"
                className="text-xs text-destructive border-destructive hover:bg-destructive/10"
                onClick={() => {
                  if (window.confirm("Are you sure you want to delete all messages? This action cannot be undone.")) {
                    deleteChatHistory.mutate(selectedUser.id);
                  }
                }}
              >
                Clear Chat
              </Button>
            </div>
          </div>
          <MessageList 
            messages={messages} 
            selectedUser={selectedUser} 
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
          />
          <MessageInput
            selectedUser={selectedUser}
            onSendMessage={handleSendMessage}
            onTyping={handleTyping}
            isLoading={sendMessage.isPending}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground bg-white/50 backdrop-blur-sm">
          Select a user to start chatting
        </div>
      )}
    </div>
  );
}