
import { GroupMessage } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Check, X, FileIcon, Image, Film, FileAudio, FileText } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface GroupMessageListProps {
  messages: any[];
  groupId: number;
  onEditMessage: (messageId: number, content: string) => void;
  onDeleteMessage: (messageId: number) => void;
}

export function GroupMessageList({
  messages,
  groupId,
  onEditMessage,
  onDeleteMessage,
}: GroupMessageListProps) {
  const { user } = useAuth();
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [messageToDelete, setMessageToDelete] = useState<number | null>(null);

  const handleStartEdit = (messageId: number, currentContent: string) => {
    setEditingMessageId(messageId);
    setEditContent(currentContent);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditContent("");
  };

  const handleSaveEdit = (messageId: number) => {
    if (editContent.trim()) {
      onEditMessage(messageId, editContent);
      setEditingMessageId(null);
      setEditContent("");
    }
  };

  const handleConfirmDelete = () => {
    if (messageToDelete !== null) {
      onDeleteMessage(messageToDelete);
      setMessageToDelete(null);
    }
  };

  const getFileIcon = (url: string) => {
    const extension = url.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
      return <Image className="h-4 w-4" />;
    } else if (['mp4', 'webm', 'mov'].includes(extension || '')) {
      return <Film className="h-4 w-4" />;
    } else if (['mp3', 'wav', 'ogg'].includes(extension || '')) {
      return <FileAudio className="h-4 w-4" />;
    } else if (['pdf', 'doc', 'docx', 'txt'].includes(extension || '')) {
      return <FileText className="h-4 w-4" />;
    }
    return <FileIcon className="h-4 w-4" />;
  };

  return (
    <>
      <ScrollArea className="h-[calc(100vh-12rem)] p-4">
        <div className="space-y-4">
          {messages.filter(m => !m.message.isDeleted).map((msg) => {
            const isOwnMessage = msg.message.senderId === user?.id;
            return (
              <div
                key={msg.message.id}
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
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        {msg.sender.profileImage ? (
                          <AvatarImage src={msg.sender.profileImage} alt={msg.sender.username} />
                        ) : (
                          <AvatarFallback>{msg.sender.username[0].toUpperCase()}</AvatarFallback>
                        )}
                      </Avatar>
                      <span className={cn(
                        "text-xs font-medium",
                        isOwnMessage ? "text-primary-foreground/80" : "text-muted-foreground"
                      )}>
                        {isOwnMessage ? "You" : msg.sender.username}
                      </span>
                    </div>
                    
                    {editingMessageId === msg.message.id ? (
                      <div className="mt-2 flex items-center gap-2">
                        <Input
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className={cn(
                            "bg-white border-blue-300",
                            isOwnMessage && "text-black"
                          )}
                          autoFocus
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-full"
                          onClick={() => handleSaveEdit(msg.message.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-full"
                          onClick={handleCancelEdit}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p className="mt-1">{msg.message.content}</p>
                        
                        {msg.message.attachmentUrl && (
                          <div className="mt-2">
                            {['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(
                              msg.message.attachmentUrl.split('.').pop()?.toLowerCase() || ''
                            ) ? (
                              <a href={msg.message.attachmentUrl} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={msg.message.attachmentUrl}
                                  alt="Attachment"
                                  className="max-w-full rounded-md max-h-[200px] object-contain bg-black/5"
                                />
                              </a>
                            ) : (
                              <a
                                href={msg.message.attachmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  "flex items-center gap-2 rounded-md p-2 bg-black/5",
                                  isOwnMessage && "bg-primary-foreground/10"
                                )}
                              >
                                {getFileIcon(msg.message.attachmentUrl)}
                                <span className="text-sm truncate">
                                  {msg.message.attachmentUrl.split('/').pop()}
                                </span>
                              </a>
                            )}
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between mt-2">
                          <span className={cn(
                            "text-xs",
                            isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}>
                            {format(new Date(msg.message.createdAt), 'HH:mm')}
                            {msg.message.lastEditedAt && " (edited)"}
                          </span>
                          
                          {isOwnMessage && (
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 rounded-full"
                                onClick={() => handleStartEdit(msg.message.id, msg.message.content)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 rounded-full text-destructive"
                                onClick={() => setMessageToDelete(msg.message.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      </ScrollArea>
      
      <AlertDialog open={messageToDelete !== null} onOpenChange={(open) => !open && setMessageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
