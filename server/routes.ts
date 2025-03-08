import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertMessageSchema, insertGroupSchema, insertGroupMessageSchema } from "@shared/schema";
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
  
  // Delete chat history between two users
  app.delete("/api/messages/:userId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const currentUserId = req.user!.id;
      const otherUserId = parseInt(req.params.userId);
      
      // Get all messages between the two users
      const messagesToDelete = await storage.getMessages(currentUserId, otherUserId);
      
      // Delete attachments associated with messages
      for (const message of messagesToDelete) {
        if (message.attachmentUrl) {
          deleteFile(message.attachmentUrl);
        }
      }
      
      // Delete all messages in the conversation
      await storage.deleteChatHistory(currentUserId, otherUserId);
      
      res.sendStatus(200);
    } catch (error) {
      console.error("Error deleting chat history:", error);
      res.status(500).json({ error: "Failed to delete chat history" });
    }
  });

  // Group chat API endpoints
  app.post("/api/groups", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      console.log("Received group creation request:", JSON.stringify(req.body));
      
      // Ensure members is always an array
      if (req.body.members && !Array.isArray(req.body.members)) {
        req.body.members = [];
      }
      
      const groupData = insertGroupSchema.parse(req.body);
      console.log("Validated group data:", JSON.stringify(groupData));
      
      const group = await storage.createGroup(req.user!.id, groupData);
      console.log("Group created successfully:", JSON.stringify(group));
      
      res.status(201).json(group);
    } catch (error: any) {
      console.error("Error creating group:", error);
      
      // Provide more specific error details
      if (error.errors) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: error.errors 
        });
      }
      
      res.status(500).json({ 
        error: "Failed to create group", 
        message: error.message || "Unknown error" 
      });
    }
  });

  app.get("/api/groups", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const groups = await storage.getUserGroups(req.user!.id);
      res.json(groups);
    } catch (error) {
      console.error("Error fetching groups:", error);
      res.status(500).json({ error: "Failed to fetch groups" });
    }
  });

  app.get("/api/groups/:groupId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const groupId = parseInt(req.params.groupId);
      
      // Check if user is a member of the group
      const isMember = await storage.isUserInGroup(req.user!.id, groupId);
      if (!isMember) {
        return res.status(403).json({ error: "You are not a member of this group" });
      }
      
      const group = await storage.getGroupById(groupId);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      
      res.json(group);
    } catch (error) {
      console.error("Error fetching group:", error);
      res.status(500).json({ error: "Failed to fetch group" });
    }
  });

  app.get("/api/groups/:groupId/members", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const groupId = parseInt(req.params.groupId);
      
      // Check if user is a member of the group
      const isMember = await storage.isUserInGroup(req.user!.id, groupId);
      if (!isMember) {
        return res.status(403).json({ error: "You are not a member of this group" });
      }
      
      const members = await storage.getGroupMembers(groupId);
      res.json(members);
    } catch (error) {
      console.error("Error fetching group members:", error);
      res.status(500).json({ error: "Failed to fetch group members" });
    }
  });

  app.post("/api/groups/:groupId/members", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const groupId = parseInt(req.params.groupId);
      const { userId } = req.body;
      
      // Check if user is an admin of the group
      const isAdmin = await storage.isUserGroupAdmin(req.user!.id, groupId);
      if (!isAdmin) {
        return res.status(403).json({ error: "You don't have permission to add members" });
      }
      
      await storage.addMemberToGroup(groupId, userId);
      res.sendStatus(201);
    } catch (error) {
      console.error("Error adding group member:", error);
      res.status(500).json({ error: "Failed to add group member" });
    }
  });

  app.delete("/api/groups/:groupId/members/:userId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const groupId = parseInt(req.params.groupId);
      const userId = parseInt(req.params.userId);
      
      // Check if user is an admin or removing themselves
      const isAdmin = await storage.isUserGroupAdmin(req.user!.id, groupId);
      if (!isAdmin && req.user!.id !== userId) {
        return res.status(403).json({ error: "You don't have permission to remove this member" });
      }
      
      await storage.removeMemberFromGroup(groupId, userId);
      res.sendStatus(200);
    } catch (error) {
      console.error("Error removing group member:", error);
      res.status(500).json({ error: "Failed to remove group member" });
    }
  });

  app.get("/api/groups/:groupId/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const groupId = parseInt(req.params.groupId);
      
      // Check if user is a member of the group
      const isMember = await storage.isUserInGroup(req.user!.id, groupId);
      if (!isMember) {
        return res.status(403).json({ error: "You are not a member of this group" });
      }
      
      const messages = await storage.getGroupMessages(groupId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching group messages:", error);
      res.status(500).json({ error: "Failed to fetch group messages" });
    }
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

        // Group chat websocket handlers
        if (message.type === "groupChat") {
          const validatedMessage = insertGroupMessageSchema.parse(message.data);
          
          // Check if user is member of the group
          const isMember = await storage.isUserInGroup(ws.userId, validatedMessage.groupId);
          if (!isMember) {
            ws.send(JSON.stringify({ 
              type: "error", 
              data: { message: "You are not a member of this group" } 
            }));
            return;
          }
          
          const savedMessage = await storage.createGroupMessage(ws.userId, validatedMessage);
          
          // Get all group members
          const groupMembers = await storage.getGroupMembers(validatedMessage.groupId);
          
          // Send message to all online group members
          for (const member of groupMembers) {
            if (member.id !== ws.userId) {
              const memberWs = clients.get(member.id);
              if (memberWs?.readyState === WebSocket.OPEN) {
                memberWs.send(JSON.stringify({ 
                  type: "groupMessage", 
                  data: { 
                    ...savedMessage,
                    groupId: validatedMessage.groupId,
                    sender: {
                      id: ws.userId,
                      username: (await storage.getUserById(ws.userId)).username
                    }
                  } 
                }));
              }
            }
          }
          
          ws.send(JSON.stringify({ 
            type: "groupMessage", 
            data: { 
              ...savedMessage,
              groupId: validatedMessage.groupId,
              sender: {
                id: ws.userId,
                username: (await storage.getUserById(ws.userId)).username
              }
            } 
          }));
        }

        if (message.type === "groupTyping") {
          // Check if user is member of the group
          const isMember = await storage.isUserInGroup(ws.userId, message.data.groupId);
          if (!isMember) {
            return;
          }
          
          // Get all group members
          const groupMembers = await storage.getGroupMembers(message.data.groupId);
          
          // Send typing status to all online group members
          for (const member of groupMembers) {
            if (member.id !== ws.userId) {
              const memberWs = clients.get(member.id);
              if (memberWs?.readyState === WebSocket.OPEN) {
                memberWs.send(JSON.stringify({
                  type: "groupTyping",
                  data: { 
                    userId: ws.userId, 
                    groupId: message.data.groupId,
                    isTyping: message.data.isTyping 
                  }
                }));
              }
            }
          }
        }

        if (message.type === "groupEditMessage") {
          const updatedMessage = await storage.editGroupMessage(
            message.data.messageId,
            message.data.content
          );
          
          // Get the group ID and check if user is a member
          const groupId = updatedMessage.groupId;
          const isMember = await storage.isUserInGroup(ws.userId, groupId);
          if (!isMember) {
            return;
          }
          
          // Get all group members
          const groupMembers = await storage.getGroupMembers(groupId);
          
          // Send updated message to all online group members
          for (const member of groupMembers) {
            if (member.id !== ws.userId) {
              const memberWs = clients.get(member.id);
              if (memberWs?.readyState === WebSocket.OPEN) {
                memberWs.send(JSON.stringify({ 
                  type: "groupMessageEdit", 
                  data: updatedMessage 
                }));
              }
            }
          }
          
          ws.send(JSON.stringify({ type: "groupMessageEdit", data: updatedMessage }));
        }

        if (message.type === "groupDeleteMessage") {
          // Check if message exists and belongs to user or user is admin
          const isAdmin = await storage.isUserGroupAdmin(ws.userId, message.data.groupId);
          
          await storage.deleteGroupMessage(message.data.messageId);
          
          // Get all group members
          const groupMembers = await storage.getGroupMembers(message.data.groupId);
          
          // Send delete notification to all online group members
          for (const member of groupMembers) {
            if (member.id !== ws.userId) {
              const memberWs = clients.get(member.id);
              if (memberWs?.readyState === WebSocket.OPEN) {
                memberWs.send(JSON.stringify({
                  type: "groupMessageDelete",
                  data: { 
                    messageId: message.data.messageId,
                    groupId: message.data.groupId
                  }
                }));
              }
            }
          }
          
          ws.send(JSON.stringify({
            type: "groupMessageDelete",
            data: { 
              messageId: message.data.messageId,
              groupId: message.data.groupId
            }
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