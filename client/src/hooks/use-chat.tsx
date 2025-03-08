import { useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Message, InsertMessage, User } from "@shared/schema";
import { useAuth } from "./use-auth";
import { useToast } from "./use-toast";
import { queryClient } from "@/lib/queryClient";

export function useChat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket>();

  const { data: users = [] } = useQuery<User[]>({
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
      }
    };

    return () => {
      ws.close();
    };
  }, [user]);

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

  const getMessages = (userId: number) => {
    return useQuery<Message[]>({
      queryKey: [`/api/messages/${userId}`],
      enabled: !!user,
    });
  };

  return {
    users,
    sendMessage,
    getMessages,
  };
}