
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Group, GroupMessage, InsertGroupMessage } from "@shared/schema";
import { useAuth } from "./use-auth";
import { useToast } from "./use-toast";
import { useWebSocket } from "./use-websocket";

export function useGroupChat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { socket, isConnected } = useWebSocket();
  const queryClient = useQueryClient();
  const [typingUsers, setTypingUsers] = useState<Map<number, Set<number>>>(new Map());
  const typingTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ["/api/groups"],
    enabled: !!user,
  });

  useEffect(() => {
    if (!socket) return;
    
    // Log connection status to help debug
    console.log("WebSocket connection status:", isConnected ? "Connected" : "Disconnected");
    
    if (!isConnected) {
      console.log("WebSocket not connected, waiting...");
      return;
    }
    
    console.log("Setting up WebSocket listeners for group chat");

    const handleGroupMessage = (data: any) => {
      // Add new message to cache
      queryClient.setQueryData(
        [`/api/groups/${data.groupId}/messages`],
        (oldData: any[] = []) => {
          // Check if message already exists
          if (oldData.some(m => m.message.id === data.id)) {
            return oldData;
          }
          
          return [
            ...oldData,
            {
              message: {
                id: data.id,
                content: data.content,
                senderId: data.sender.id,
                groupId: data.groupId,
                createdAt: data.createdAt,
                isDeleted: false,
                attachmentUrl: data.attachmentUrl,
              },
              sender: data.sender,
            },
          ];
        }
      );
    };

    const handleGroupTyping = (data: any) => {
      const { userId, groupId, isTyping } = data;
      
      setTypingUsers(prev => {
        const newMap = new Map(prev);
        let groupTypers = newMap.get(groupId) || new Set();
        
        if (isTyping) {
          groupTypers.add(userId);
        } else {
          groupTypers.delete(userId);
        }
        
        newMap.set(groupId, groupTypers);
        return newMap;
      });
      
      // Clear typing status after 3 seconds of no updates
      const timeoutKey = `${groupId}-${userId}`;
      if (typingTimeoutRef.current[timeoutKey]) {
        clearTimeout(typingTimeoutRef.current[timeoutKey]);
      }
      
      if (isTyping) {
        typingTimeoutRef.current[timeoutKey] = setTimeout(() => {
          setTypingUsers(prev => {
            const newMap = new Map(prev);
            const groupTypers = newMap.get(groupId);
            if (groupTypers) {
              groupTypers.delete(userId);
              if (groupTypers.size === 0) {
                newMap.delete(groupId);
              } else {
                newMap.set(groupId, groupTypers);
              }
            }
            return newMap;
          });
        }, 3000);
      }
    };

    const handleGroupMessageEdit = (data: any) => {
      queryClient.setQueryData(
        [`/api/groups/${data.groupId}/messages`],
        (oldData: any[] = []) => {
          return oldData.map(item => {
            if (item.message.id === data.id) {
              return {
                ...item,
                message: {
                  ...item.message,
                  content: data.content,
                  lastEditedAt: data.lastEditedAt,
                },
              };
            }
            return item;
          });
        }
      );
    };

    const handleGroupMessageDelete = (data: any) => {
      queryClient.setQueryData(
        [`/api/groups/${data.groupId}/messages`],
        (oldData: any[] = []) => {
          return oldData.map(item => {
            if (item.message.id === data.messageId) {
              return {
                ...item,
                message: {
                  ...item.message,
                  isDeleted: true,
                },
              };
            }
            return item;
          });
        }
      );
    };

    socket.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "groupMessage") {
          handleGroupMessage(data.data);
        }
        
        if (data.type === "groupTyping") {
          handleGroupTyping(data.data);
        }
        
        if (data.type === "groupMessageEdit") {
          handleGroupMessageEdit(data.data);
        }
        
        if (data.type === "groupMessageDelete") {
          handleGroupMessageDelete(data.data);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    });

    return () => {
      // Clear all typing timeouts
      Object.values(typingTimeoutRef.current).forEach(timeout => {
        clearTimeout(timeout);
      });
    };
  }, [isConnected, socket, queryClient]);

  const sendGroupMessage = useMutation({
    mutationFn: async ({ content, groupId, attachmentUrl }: InsertGroupMessage) => {
      console.log("Sending group message:", { content, groupId, attachmentUrl });
      console.log("Socket status:", { socket: !!socket, isConnected });
      
      // Wait for connection with improved timeout
      if (!socket || !isConnected) {
        const waitForConnection = (maxAttempts = 10): Promise<void> => {
          return new Promise((resolve, reject) => {
            let attempts = 0;
            const checkConnection = () => {
              attempts++;
              console.log(`Connection attempt ${attempts}, socket: ${!!socket}, connected: ${isConnected}`);
              if (socket && isConnected) {
                resolve();
              } else if (attempts >= maxAttempts) {
                reject(new Error("WebSocket connection timeout"));
              } else {
                setTimeout(checkConnection, 1000);
              }
            };
            checkConnection();
          });
        };
        
        try {
          console.log("Waiting for connection...");
          await waitForConnection();
          console.log("Connection established");
        } catch (error) {
          console.error("WebSocket connection failed:", error);
          toast({
            title: "Connection Error",
            description: "Could not connect to chat server. Please refresh the page.",
            variant: "destructive",
          });
          throw new Error("WebSocket not connected. Please try again later.");
        }
      }
      
      if (!socket || !isConnected) {
        toast({
          title: "Connection Error",
          description: "Not connected to chat server. Please refresh the page.",
          variant: "destructive",
        });
        throw new Error("WebSocket not connected");
      }
      
      socket.send(
        JSON.stringify({
          type: "groupChat",
          data: { content, groupId, attachmentUrl },
        })
      );
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to send message: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const editGroupMessage = useMutation({
    mutationFn: async ({ messageId, content, groupId }: { messageId: number; content: string; groupId: number }) => {
      if (!socket || !isConnected) {
        throw new Error("WebSocket not connected");
      }
      
      socket.send(
        JSON.stringify({
          type: "groupEditMessage",
          data: { messageId, content, groupId },
        })
      );
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to edit message: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const deleteGroupMessage = useMutation({
    mutationFn: async ({ messageId, groupId }: { messageId: number; groupId: number }) => {
      if (!socket || !isConnected) {
        throw new Error("WebSocket not connected");
      }
      
      socket.send(
        JSON.stringify({
          type: "groupDeleteMessage",
          data: { messageId, groupId },
        })
      );
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete message: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const sendGroupTypingStatus = (groupId: number, isTyping: boolean) => {
    if (!socket || !isConnected || !user) return;
    
    socket.send(
      JSON.stringify({
        type: "groupTyping",
        data: { groupId, isTyping },
      })
    );
  };

  const getGroupMessages = (groupId: number) => {
    return useQuery<any[]>({
      queryKey: [`/api/groups/${groupId}/messages`],
      enabled: !!user && !!groupId,
    });
  };

  const getGroupMembers = (groupId: number) => {
    return useQuery<any[]>({
      queryKey: [`/api/groups/${groupId}/members`],
      enabled: !!user && !!groupId,
    });
  };

  return {
    groups,
    sendGroupMessage,
    editGroupMessage,
    deleteGroupMessage,
    getGroupMessages,
    getGroupMembers,
    typingUsers,
    sendGroupTypingStatus,
  };
}

import { useRef } from "react";
