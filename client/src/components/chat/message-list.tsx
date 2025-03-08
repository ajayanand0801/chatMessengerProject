import { Message, User } from "@shared/schema";
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

const ImagePreview = ({ url }: { url: string }) => {
  return (
    <div className="mt-2 rounded-lg overflow-hidden">
      <img 
        src={url} 
        alt="Attachment" 
        className="max-w-sm max-h-64 object-contain"
        onClick={() => window.open(url, '_blank')}
        style={{ cursor: 'pointer' }}
      />
    </div>
  );
};

export function MessageList({
  messages,
  selectedUser,
  onEditMessage,
  onDeleteMessage,
}: {
  messages: Message[];
  selectedUser: User;
  onEditMessage: (messageId: number, content: string) => void;
  onDeleteMessage: (messageId: number) => void;
}) {
  const { user } = useAuth();
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);

  const handleEdit = (message: Message) => {
    setEditingMessageId(message.id);
    setEditContent(message.content);
  };

  const handleSaveEdit = (messageId: number) => {
    onEditMessage(messageId, editContent);
    setEditingMessageId(null);
    setEditContent("");
  };

  const handleDelete = (message: Message) => {
    if (message.attachmentUrl) {
      setMessageToDelete(message);
    } else {
      onDeleteMessage(message.id);
    }
  };

  const getFileIcon = (url: string) => {
    const extension = url.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif'].includes(extension || '')) return <Image className="h-4 w-4" />;
    if (['mp4', 'webm', 'mov'].includes(extension || '')) return <Film className="h-4 w-4" />;
    if (['mp3', 'wav', 'ogg'].includes(extension || '')) return <FileAudio className="h-4 w-4" />;
    if (['pdf', 'doc', 'docx'].includes(extension || '')) return <FileText className="h-4 w-4" />;
    return <FileIcon className="h-4 w-4" />;
  };

  const getFileName = (url: string) => {
    return url.split('/').pop() || 'file';
  };

  return (
    <>
      <ScrollArea className="h-[calc(100vh-12rem)] p-4">
        <div className="space-y-4">
          {messages.filter(m => !m.isDeleted).map((message) => {
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

                    {editingMessageId === message.id ? (
                      <div className="flex gap-2">
                        <Input
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="bg-white text-foreground"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleSaveEdit(message.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditingMessageId(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm break-words">{message.content}</p>
                        {message.attachmentUrl && (
                          <>
                            {['jpg', 'jpeg', 'png', 'gif'].includes(message.attachmentUrl.split('.').pop()?.toLowerCase() || '') ? (
                              <ImagePreview url={message.attachmentUrl} />
                            ) : (
                              <div className="mt-2 flex items-center gap-2">
                                {getFileIcon(message.attachmentUrl)}
                                <a 
                                  href={message.attachmentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={cn(
                                    "text-xs underline hover:no-underline",
                                    isOwnMessage ? "text-primary-foreground/90" : "text-primary"
                                  )}
                                >
                                  {getFileName(message.attachmentUrl)}
                                </a>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}

                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-xs",
                        isOwnMessage ? "text-primary-foreground/60" : "text-muted-foreground/60"
                      )}>
                        {format(new Date(message.createdAt), "h:mm a")}
                        {message.lastEditedAt && " (edited)"}
                      </span>

                      {isOwnMessage && !editingMessageId && (
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => handleEdit(message)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => handleDelete(message)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}

                      {isOwnMessage && (
                        <span className={cn(
                          "text-xs",
                          isOwnMessage ? "text-primary-foreground/60" : "text-muted-foreground/60"
                        )}>
                          {message.isRead ? "✓✓" : "✓"}
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <AlertDialog open={!!messageToDelete} onOpenChange={() => setMessageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message with attachment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete both the message and its attachment. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (messageToDelete) {
                onDeleteMessage(messageToDelete.id);
                setMessageToDelete(null);
              }
            }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}