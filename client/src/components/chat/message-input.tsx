import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, X } from "lucide-react";
import { User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface MessageInputProps {
  selectedUser?: User;
  onSendMessage: (content: string, attachmentUrl?: string) => void;
  onTyping: (isTyping: boolean) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function MessageInput({
  selectedUser,
  onSendMessage,
  onTyping,
  isLoading = false,
  placeholder,
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSend = async () => {
    if (isLoading || isUploading) return;

    if (!message.trim() && !attachment) return;

    let attachmentUrl: string | undefined;

    if (attachment) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", attachment);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Failed to upload file");
        }

        const data = await response.json();
        attachmentUrl = data.url;
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to upload attachment",
          variant: "destructive",
        });
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    onSendMessage(message, attachmentUrl);
    setMessage("");
    setAttachment(null);
    setAttachmentPreview(null);
    onTyping(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File size exceeds the 10MB limit",
        variant: "destructive",
      });
      return;
    }

    setAttachment(file);

    // Create a preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setAttachmentPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setAttachmentPreview(null);
    }
  };

  const removeAttachment = () => {
    setAttachment(null);
    setAttachmentPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);

    // Send typing indicator
    onTyping(value.length > 0);

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing indicator after 2 seconds of inactivity
    if (value.length > 0) {
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 2000);
    }
  };

  // Clean up typing timeout on unmount or user change
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        onTyping(false);
      }
    };
  }, [selectedUser, onTyping]);

  const getPlaceholder = () => {
    if (placeholder) return placeholder;
    return selectedUser ? `Message ${selectedUser.username}...` : "Type a message...";
  };

  return (
    <div className="p-4 border-t bg-white">
      {attachment && (
        <div className="mb-2 p-2 border rounded-md flex items-center justify-between bg-accent/20">
          <div className="flex items-center gap-2 max-w-[80%] truncate">
            {attachmentPreview ? (
              <img 
                src={attachmentPreview} 
                alt="Preview" 
                className="h-10 w-10 object-cover rounded" 
              />
            ) : (
              <div className="h-10 w-10 bg-primary/10 flex items-center justify-center rounded">
                <Paperclip className="h-5 w-5 text-primary" />
              </div>
            )}
            <span className="truncate text-sm">{attachment.name}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={removeAttachment}
            className="h-7 w-7"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleAttachmentClick}
          disabled={isLoading || isUploading}
          className="rounded-full h-10 w-10"
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        <Textarea
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyPress}
          placeholder={getPlaceholder()}
          className="flex-1 min-h-[2.5rem] max-h-28 resize-none"
          disabled={isLoading || isUploading}
        />
        <Button
          type="button"
          size="icon"
          onClick={handleSend}
          disabled={(isLoading || isUploading || (!message.trim() && !attachment))}
          className="rounded-full h-10 w-10"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}