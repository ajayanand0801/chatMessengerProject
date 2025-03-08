import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertMessageSchema } from "@shared/schema";

interface WebSocketWithId extends WebSocket {
  userId?: number;
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  const clients = new Map<number, WebSocketWithId>();

  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const users = await storage.getAllUsers();
    const unreadCounts = await storage.getUnreadMessageCount(req.user!.id);
    res.json(users.filter(u => u.id !== req.user!.id).map(u => ({
      ...u,
      unreadCount: unreadCounts[u.id] || 0
    })));
  });

  app.get("/api/messages/:userId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const messages = await storage.getMessages(
      req.user!.id,
      parseInt(req.params.userId),
    );

    // Mark received messages as read
    for (const message of messages) {
      if (message.receiverId === req.user!.id && !message.isRead) {
        await storage.markMessageAsRead(message.id);
      }
    }

    res.json(messages);
  });

  wss.on("connection", (ws: WebSocketWithId) => {
    ws.on("message", async (data: string) => {
      try {
        const message = JSON.parse(data);

        if (message.type === "auth") {
          ws.userId = message.userId;
          clients.set(message.userId, ws);
          await storage.setUserOnlineStatus(message.userId, true);
          return;
        }

        if (!ws.userId) {
          ws.close();
          return;
        }

        if (message.type === "chat") {
          const validatedMessage = insertMessageSchema.parse(message.data);
          const savedMessage = await storage.createMessage(ws.userId, validatedMessage);

          const receiverWs = clients.get(validatedMessage.receiverId);
          if (receiverWs?.readyState === WebSocket.OPEN) {
            receiverWs.send(JSON.stringify({ type: "message", data: savedMessage }));
          }

          ws.send(JSON.stringify({ type: "message", data: savedMessage }));
        }

        if (message.type === "typing") {
          const receiverWs = clients.get(message.data.receiverId);
          if (receiverWs?.readyState === WebSocket.OPEN) {
            receiverWs.send(JSON.stringify({
              type: "typing",
              data: { userId: ws.userId, isTyping: message.data.isTyping }
            }));
          }
        }

        if (message.type === "edit") {
          const updatedMessage = await storage.editMessage(
            message.data.messageId,
            message.data.content
          );
          const receiverWs = clients.get(updatedMessage.receiverId);
          if (receiverWs?.readyState === WebSocket.OPEN) {
            receiverWs.send(JSON.stringify({ type: "messageEdit", data: updatedMessage }));
          }
          ws.send(JSON.stringify({ type: "messageEdit", data: updatedMessage }));
        }

        if (message.type === "delete") {
          await storage.deleteMessage(message.data.messageId);
          const receiverWs = clients.get(message.data.receiverId);
          if (receiverWs?.readyState === WebSocket.OPEN) {
            receiverWs.send(JSON.stringify({
              type: "messageDelete",
              data: { messageId: message.data.messageId }
            }));
          }
          ws.send(JSON.stringify({
            type: "messageDelete",
            data: { messageId: message.data.messageId }
          }));
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });

    ws.on("close", () => {
      if (ws.userId) {
        storage.setUserOnlineStatus(ws.userId, false);
        clients.delete(ws.userId);
      }
    });
  });

  return httpServer;
}