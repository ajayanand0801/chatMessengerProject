import { useState, useEffect, useRef } from "react";
import { User } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Smile, Paperclip } from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function MessageInput({
  selectedUser,
  onSendMessage,
  onTyping,
  isLoading,
}: {
  selectedUser: User;
  onSendMessage: (content: string, attachmentUrl?: string) => void;
  onTyping: (isTyping: boolean) => void;
  isLoading: boolean;
}) {
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);

    if (!isTyping) {
      setIsTyping(true);
      onTyping(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      onTyping(false);
    }, 1000);
  };

  const handleEmojiClick = (emojiData: any) => {
    setMessage((prev) => prev + emojiData.emoji);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() && !file) return;

    let attachmentUrl: string | undefined;
    if (file) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!response.ok) throw new Error("Upload failed");
        const data = await response.json();
        attachmentUrl = data.url;
      } catch (error) {
        console.error("File upload failed:", error);
        return;
      }
    }

    onSendMessage(message, attachmentUrl);
    setMessage("");
    setFile(null);
    setIsTyping(false);
    onTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 flex gap-2 bg-white/50 backdrop-blur-sm border-t">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => fileInputRef.current?.click()}
        className="shrink-0"
      >
        <Paperclip className="h-4 w-4" />
      </Button>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="shrink-0">
            <Smile className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 border-none">
          <EmojiPicker onEmojiClick={handleEmojiClick} />
        </PopoverContent>
      </Popover>
      <div className="flex-1">
        <Input
          value={message}
          onChange={handleChange}
          placeholder={file ? `${file.name} selected...` : "Type a message..."}
          disabled={isLoading}
          className="bg-white"
        />
      </div>
      <Button type="submit" disabled={isLoading} className="shrink-0">
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}