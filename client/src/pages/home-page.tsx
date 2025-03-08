import { useState, useEffect } from "react";
import { User, Group } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useChat } from "@/hooks/use-chat";
import { useGroupChat } from "@/hooks/use-group-chat";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserList } from "@/components/chat/user-list";
import { GroupList } from "@/components/chat/group-list";
import { MessageList } from "@/components/chat/message-list";
import { GroupMessageList } from "@/components/chat/group-message-list";
import { MessageInput } from "@/components/chat/message-input";
import { LogOut, Users, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const { 
    users, 
    sendMessage, 
    getMessages, 
    typingUsers, 
    sendTypingStatus, 
    editMessage, 
    deleteMessage, 
    deleteChatHistory 
  } = useChat();

  const {
    groups,
    sendGroupMessage,
    editGroupMessage,
    deleteGroupMessage,
    getGroupMessages,
    getGroupMembers,
    typingUsers: groupTypingUsers,
    sendGroupTypingStatus
  } = useGroupChat();

  const [selectedUser, setSelectedUser] = useState<User>();
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [activeTab, setActiveTab] = useState<string>("direct");

  const { data: messages = [] } = getMessages(selectedUser?.id ?? 0);
  const { data: groupMessages = [] } = getGroupMessages(selectedGroup?.id ?? 0);
  const { data: groupMembers = [] } = getGroupMembers(selectedGroup?.id ?? 0);

  // Reset selections when changing tabs
  useEffect(() => {
    if (activeTab === "direct") {
      setSelectedGroup(null);
    } else {
      setSelectedUser(undefined);
    }
  }, [activeTab]);

  const handleSendMessage = (content: string, attachmentUrl?: string) => {
    if (activeTab === "direct" && selectedUser) {
      sendMessage.mutate({
        content,
        receiverId: selectedUser.id,
        attachmentUrl,
      });
    } else if (activeTab === "groups" && selectedGroup) {
      sendGroupMessage.mutate({
        content,
        groupId: selectedGroup.id,
        attachmentUrl,
      });
    }
  };

  const handleTyping = (isTyping: boolean) => {
    if (activeTab === "direct" && selectedUser) {
      sendTypingStatus(selectedUser.id, isTyping);
    } else if (activeTab === "groups" && selectedGroup) {
      sendGroupTypingStatus(selectedGroup.id, isTyping);
    }
  };

  const handleEditMessage = (messageId: number, content: string) => {
    if (activeTab === "direct" && selectedUser) {
      editMessage.mutate({
        messageId,
        content,
        receiverId: selectedUser.id,
      });
    } else if (activeTab === "groups" && selectedGroup) {
      editGroupMessage.mutate({
        messageId,
        content,
        groupId: selectedGroup.id,
      });
    }
  };

  const handleDeleteMessage = (messageId: number) => {
    if (activeTab === "direct" && selectedUser) {
      deleteMessage.mutate({
        messageId,
        receiverId: selectedUser.id,
      });
    } else if (activeTab === "groups" && selectedGroup) {
      deleteGroupMessage.mutate({
        messageId,
        groupId: selectedGroup.id,
      });
    }
  };

  const handleDeleteChatHistory = () => {
    if (activeTab === "direct" && selectedUser) {
      deleteChatHistory.mutate(selectedUser.id);
    }
    // Group chat history deletion would go here
  };

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setActiveTab("direct");
  };

  const handleSelectGroup = (group: Group) => {
    setSelectedGroup(group);
    setActiveTab("groups");
  };

  const getGroupTypingText = () => {
    if (!selectedGroup || !groupTypingUsers.has(selectedGroup.id)) {
      return null;
    }

    const typers = groupTypingUsers.get(selectedGroup.id);
    if (!typers || typers.size === 0) {
      return null;
    }

    // Find usernames of people typing
    const typingUsernames = groupMembers
      .filter(member => typers.has(member.id) && member.id !== user?.id)
      .map(member => member.username);

    if (typingUsernames.length === 0) {
      return null;
    } else if (typingUsernames.length === 1) {
      return `${typingUsernames[0]} is typing...`;
    } else if (typingUsernames.length === 2) {
      return `${typingUsernames[0]} and ${typingUsernames[1]} are typing...`;
    } else {
      return "Several people are typing...";
    }
  };

  return (
    <div className="flex h-screen">
      <div className="w-72 border-r flex flex-col bg-gray-50">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar>
                {user?.profileImage ? (
                  <AvatarImage src={user.profileImage} alt={user.username} />
                ) : (
                  <AvatarFallback>{user?.username[0].toUpperCase()}</AvatarFallback>
                )}
              </Avatar>
              <h1 className="font-bold">{user?.username}</h1>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logoutMutation.mutate()}
              className="text-gray-500"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid grid-cols-2 mx-2 mt-2">
            <TabsTrigger value="direct" className="flex items-center gap-1">
              <UserIcon className="h-4 w-4" />
              <span>Direct</span>
            </TabsTrigger>
            <TabsTrigger value="groups" className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>Groups</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="direct" className="flex-1 overflow-hidden flex flex-col mt-2">
            <UserList
              users={users}
              selectedUser={selectedUser}
              onSelectUser={handleSelectUser}
              typingUsers={typingUsers}
              className="flex-1 overflow-auto"
            />
          </TabsContent>

          <TabsContent value="groups" className="flex-1 overflow-hidden flex flex-col mt-2">
            <GroupList
              groups={groups}
              users={users}
              selectedGroup={selectedGroup}
              onSelectGroup={handleSelectGroup}
              className="flex-1 overflow-auto"
            />
          </TabsContent>
        </Tabs>
      </div>

      {activeTab === "direct" && selectedUser ? (
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
                    handleDeleteChatHistory();
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
      ) : activeTab === "groups" && selectedGroup ? (
        <div className="flex-1 flex flex-col bg-white/50 backdrop-blur-sm">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar>
                  {selectedGroup.profileImage ? (
                    <AvatarImage src={selectedGroup.profileImage} alt={selectedGroup.name} />
                  ) : (
                    <AvatarFallback>
                      <Users className="h-4 w-4" />
                    </AvatarFallback>
                  )}
                </Avatar>
                <div>
                  <h2 className="font-semibold text-primary">{selectedGroup.name}</h2>
                  <div className="text-xs text-muted-foreground">
                    {groupMembers.length} members
                  </div>
                </div>
                {getGroupTypingText() && (
                  <span className="text-xs italic text-muted-foreground ml-2">
                    {getGroupTypingText()}
                  </span>
                )}
              </div>
            </div>
          </div>
          <GroupMessageList 
            messages={groupMessages} 
            groupId={selectedGroup.id}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
          />
          <MessageInput
            onSendMessage={handleSendMessage}
            onTyping={handleTyping}
            isLoading={sendGroupMessage.isPending}
            placeholder="Type a message to the group..."
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground bg-white/50 backdrop-blur-sm">
          {activeTab === "direct" ? "Select a user to start chatting" : "Select a group to start chatting"}
        </div>
      )}
    </div>
  );
}