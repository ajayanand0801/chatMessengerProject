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
    res.json(users.filter(u => u.id !== req.user!.id));
  });

  app.get("/api/messages/:userId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const messages = await storage.getMessages(
      req.user!.id,
      parseInt(req.params.userId),
    );
    res.json(messages);
  });

  wss.on("connection", (ws: WebSocketWithId) => {
    ws.on("message", async (data: string) => {
      try {
        const message = JSON.parse(data);
        
        if (message.type === "auth") {
          ws.userId = message.userId;
          clients.set(message.userId, ws);
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
