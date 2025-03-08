import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Message, InsertMessage, User } from "@shared/schema";
import { useAuth } from "./use-auth";
import { useToast } from "./use-toast";
import { queryClient } from "@/lib/queryClient";

export function useChat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket>();
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
  const typingTimeoutRef = useRef<Record<number, NodeJS.Timeout>>({});

  const { data: users = [] } = useQuery<(User & { unreadCount?: number })[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "auth", userId: user.id }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "message") {
        queryClient.invalidateQueries({ queryKey: [`/api/messages/${message.data.senderId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/messages/${message.data.receiverId}`] });
        queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      } else if (message.type === "typing") {
        const { userId, isTyping } = message.data;
        setTypingUsers((prev) => {
          const next = new Set(prev);
          if (isTyping) {
            next.add(userId);
          } else {
            next.delete(userId);
          }
          return next;
        });

        if (typingTimeoutRef.current[userId]) {
          clearTimeout(typingTimeoutRef.current[userId]);
        }

        if (isTyping) {
          typingTimeoutRef.current[userId] = setTimeout(() => {
            setTypingUsers((prev) => {
              const next = new Set(prev);
              next.delete(userId);
              return next;
            });
          }, 3000);
        }
      } else if (message.type === "messageEdit" || message.type === "messageDelete") {
        queryClient.invalidateQueries({ queryKey: [`/api/messages/${message.data.senderId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/messages/${message.data.receiverId}`] });
      }
    };

    return () => {
      ws.close();
    };
  }, [user]);

  const sendTypingStatus = (receiverId: number, isTyping: boolean) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: "typing",
      data: { receiverId, isTyping }
    }));
  };

  const sendMessage = useMutation({
    mutationFn: async (message: InsertMessage) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        throw new Error("WebSocket not connected");
      }
      wsRef.current.send(JSON.stringify({ type: "chat", data: message }));
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const editMessage = useMutation({
    mutationFn: async ({ messageId, content, receiverId }: { messageId: number; content: string; receiverId: number }) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        throw new Error("WebSocket not connected");
      }
      wsRef.current.send(JSON.stringify({
        type: "edit",
        data: { messageId, content, receiverId }
      }));
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to edit message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMessage = useMutation({
    mutationFn: async ({ messageId, receiverId }: { messageId: number; receiverId: number }) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        throw new Error("WebSocket not connected");
      }
      wsRef.current.send(JSON.stringify({
        type: "delete",
        data: { messageId, receiverId }
      }));
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getMessages = (userId: number) => {
    return useQuery<Message[]>({
      queryKey: [`/api/messages/${userId}`],
      enabled: !!user && !!userId,
    });
  };

  return {
    users,
    sendMessage,
    editMessage,
    deleteMessage,
    getMessages,
    typingUsers,
    sendTypingStatus,
  };
}