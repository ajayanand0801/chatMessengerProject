import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertMessageSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";

interface WebSocketWithId extends WebSocket {
  userId?: number;
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: './uploads/',
    filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

// Helper function to delete file
const deleteFile = (filePath: string) => {
  if (!filePath) return;

  // Remove the leading '/' from the file path
  const relativePath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
  const fullPath = path.join(__dirname, '..', relativePath);
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  }
};

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

  // File upload endpoint for both attachments and profile images
  app.post("/api/upload", upload.single('file'), (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
  });

  // Update profile image
  app.post("/api/profile-image", upload.single('file'), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const fileUrl = `/uploads/${req.file.filename}`;
    await storage.updateProfileImage(req.user!.id, fileUrl);
    res.json({ url: fileUrl });
  });

  // Serve uploaded files
  app.use('/uploads', express.static('uploads'));

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
          const oldMessage = await storage.getMessage(message.data.messageId);
          if (oldMessage?.attachmentUrl) {
            deleteFile(oldMessage.attachmentUrl);
          }

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