import { User } from "@supabase/supabase-js";
import { NextFunction, Request, Response } from "express";
import { idSchema } from "../schema";
import { prisma } from "../resources";
import {
  updateChatSchema,
  deleteChatSchema,
  shareChatSchema,
  unshareChatSchema,
  generateResponseFromPromptSchema,
} from "../schema/chat";
import { MessageType, SnippetType } from "@prisma/client";
import { getFilteredMessages } from "../lib";
import { validateJWT } from "./auth";

export const getChat = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const result = idSchema.safeParse(req.params);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid chat ID format" });
  }

  const { id } = req.params;

  const chat = await prisma.chat.findUnique({
    where: { id },
    include: { messages: true },
  });

  if (!chat) {
    return res.status(404).json({ error: "Chat not found" });
  }

  if (chat.public) {
    const filterMessages = await getFilteredMessages(chat);
    return res.status(200).json({
      message: "Received chat successfully",
      data: {
        messages: filterMessages,
      },
    });
  }

  // For private chat, validate token
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(400).json({ error: "Token is required" });
  }

  try {
    const { user } = await validateJWT(token);
    // @ts-ignore
    req.user = user;
    // @ts-ignore
    req.token = token;
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
  // @ts-ignore
  const user = req.user as User;
  const userId = user.id;

  if (chat.userId !== userId) {
    return res
      .status(403)
      .json({ error: "You do not have permission to access this chat" });
  }

  const filterMessages = getFilteredMessages(chat);
  return res.status(200).json({
    message: "Received chat successfully",
    data: {
      messages: filterMessages,
    },
  });
};

export const createChat = async (req: Request, res: Response) => {
  // @ts-ignore
  const user = req.user as User;
  const userId = user.id;

  try {
    const newChat = await prisma.chat.create({
      data: {
        userId,
        public: false,
      },
    });
    return res.status(201).json({
      message: "Chat created successfully",
      data: { id: newChat.id },
    });
  } catch (e) {
    return res.status(500).json({ error: "Failed to create chat" });
  }
};

export const updateChat = async (req: Request, res: Response) => {
  const idResult = idSchema.safeParse(req.params);
  const bodyResult = updateChatSchema.safeParse(req.body);

  if (!idResult.success || !bodyResult.success) {
    return res.status(400).json({
      error: "Invalid parameters or body structure",
    });
  }

  const { id } = req.params;
  const { messageId, prompt } = req.body;

  // @ts-ignore
  const user = req.user as User;
  const userId = user.id;

  const chat = await prisma.chat.findUnique({
    where: { id },
  });

  if (!chat) {
    return res.status(404).json({ error: "Chat not found" });
  }

  if (chat.userId !== userId) {
    return res
      .status(403)
      .json({ error: "You do not have permission to update this chat" });
  }

  const message = await prisma.message.findUnique({
    where: { id: messageId },
  });

  if (!message) {
    return res.status(404).json({ error: "Message not found" });
  }

  if (message.from !== MessageType.USER) {
    return res
      .status(403)
      .json({ error: "Message edited must be a previous user prompt" });
  }

  try {
    await prisma.snippet.updateMany({
      where: {
        messageId: message.id,
      },
      data: {
        content: prompt,
      },
    });
  } catch (e) {
    return res.status(500).json({
      error: "Failed to update chat",
    });
  }

  return res.status(200).json({ message: "Chat updated successfully" });
};

export const deleteChat = async (req: Request, res: Response) => {
  const result = deleteChatSchema.safeParse(req.params);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid chat ID format" });
  }

  const { id } = req.params;
  // @ts-ignore
  const user = req.user as User;
  const userId = user.id;

  const chat = await prisma.chat.findUnique({
    where: { id },
  });

  if (!chat) {
    return res.status(404).json({ error: "Chat not found" });
  }

  if (chat.userId !== userId) {
    return res
      .status(403)
      .json({ error: "You do not have permission to delete this chat" });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const messages = await tx.message.findMany({
        where: { chatId: chat.id },
      });
      for (const message of messages) {
        await tx.snippet.deleteMany({
          where: { messageId: message.id },
        });
      }
      await tx.message.deleteMany({
        where: {
          chatId: chat.id,
        },
      });
      await tx.chat.delete({
        where: { id: chat.id },
      });
    });
  } catch (e) {
    return res.status(500).json({ error: "Failed to delete chat" });
  }

  return res.status(200).json({ message: "Chat deleted successfully" });
};

export const shareChat = async (req: Request, res: Response) => {
  const result = shareChatSchema.safeParse(req.params);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid chat ID format" });
  }

  const { id } = req.params;
  const chat = await prisma.chat.findUnique({
    where: { id },
  });

  if (!chat) {
    return res.status(404).json({ error: "Chat not found" });
  }

  // @ts-ignore
  const user = req.user as User;
  if (chat.userId !== user.id) {
    return res
      .status(403)
      .json({ error: "You do not have permission to share this chat" });
  }
  try {
    await prisma.chat.update({
      where: { id },
      data: { public: true },
    });
  } catch (e) {
    return res.status(500).json({ error: "Failed to share chat" });
  }

  return res.status(200).json({ message: "Chat made public" });
};

export const unshareChat = async (req: Request, res: Response) => {
  const result = unshareChatSchema.safeParse(req.params);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid chat ID format" });
  }

  const { id } = req.params;
  const chat = await prisma.chat.findUnique({
    where: { id },
  });

  if (!chat) {
    return res.status(404).json({ error: "Chat not found" });
  }

  // @ts-ignore
  const user = req.user as User;
  if (chat.userId !== user.id) {
    return res
      .status(403)
      .json({ error: "You do not have permission to unshare this chat" });
  }

  try {
    await prisma.chat.update({
      where: { id },
      data: { public: false },
    });
  } catch (e) {
    return res.status(500).json({ error: "Failed to unshare chat" });
  }

  return res.status(200).json({ message: "Chat made private" });
};

export const generateResponseFromPrompt = async (
  req: Request,
  res: Response
) => {
  const idResult = idSchema.safeParse(req.params);
  const bodyResult = generateResponseFromPromptSchema.safeParse(req.body);
  if (!idResult.success || !bodyResult.success) {
    return res.status(400).json({ error: "Invalid id or prompt" });
  }
  // @ts-ignore
  const user = req.user as User;
  const userId = user.id;

  const { id } = req.params;
  const chat = await prisma.chat.findUnique({
    where: { id },
  });
  if (!chat) {
    return res.status(404).json({ error: "Chat not found" });
  }

  if (!chat.public && chat.userId !== userId) {
    return res
      .status(403)
      .json({ error: "You do not have permission to access chat" });
  }

  const { prompt } = req.body;
  // TODO: Do some ml magic

  // output
  const ouptut = "something";
  await prisma.$transaction(async (tx) => {
    // User
    const userMessage = await tx.message.create({
      data: {
        from: MessageType.USER,
        chatId: chat.id,
      },
    });
    await tx.snippet.create({
      data: {
        type: SnippetType.TEXT,
        messageId: userMessage.id,
        content: prompt,
        order: 1,
      },
    });

    // Bot
    const chatMessage = await tx.message.create({
      data: {
        from: MessageType.BOT,
        chatId: chat.id,
      },
    });
    // TODO: create snippets
  });
};
