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

export const getChat = async (req: Request, res: Response) => {
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

  const filterMessages = await getFilteredMessages(chat);
  return res.status(200).json({
    message: "Received chat successfully",
    data: {
      messages: filterMessages,
    },
  });
};

export const getRecentChat = async (req: Request, res: Response) => {
  // @ts-ignore
  const user = req.user as User;
  const userId = user.id;
  const chats = await prisma.chat.findMany({
    where: { userId: userId },
    include: { messages: true },
    orderBy: {
      createdAt: "asc",
    },
  });
  if (!chats.length) {
    return res.status(200).json({
      message: "No chat available",
      data: {
        messages: [],
      },
    });
  }
  const filterMessages = await getFilteredMessages(chats[chats.length - 1]);
  const recentChat = chats[chats.length - 1];

  return res.status(200).json({
    message: "Received chat successfully",
    data: {
      id: recentChat.id,
      messages: filterMessages,
      timestamp: recentChat.createdAt,
    },
  });
};

export const getChats = async (req: Request, res: Response) => {
  // @ts-ignore
  const user = req.user as User;
  const userId = user.id;

  const chats = await prisma.chat.findMany({
    where: { userId: userId },
    include: { messages: true },
  });
  const filterChatsMessages = [];
  for (const chat of chats) {
    filterChatsMessages.push(await getFilteredMessages(chat));
  }
  return res.status(200).json({
    message: "Received chats successfully",
    data: {
      chats: filterChatsMessages,
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

  const { prompt, response } = req.body;

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
    // Split assistant response into code/text snippets
    const regex = /```[\s\S]*?```/g;
    let order = 1;
    let lastIndex = 0;
    const matches = Array.from(response.matchAll(regex)) as RegExpMatchArray[];

    if (matches.length === 0) {
      // No fenced code blocks – use heuristics: if looks like Strudel code treat as CODE else TEXT
      await tx.snippet.create({
        data: {
          type: isProbablyCode(response) ? SnippetType.CODE : SnippetType.TEXT,
          messageId: chatMessage.id,
          content: cleanBackticks(response),
          order,
        },
      });
    } else {
      for (const match of matches) {
        const start = (match as RegExpMatchArray).index as number;
        const end = start + match[0].length;

        // text before code block
        if (start > lastIndex) {
          const textSeg = response.slice(lastIndex, start).trim();
          if (textSeg) {
            await tx.snippet.create({
              data: {
                type: SnippetType.TEXT,
                messageId: chatMessage.id,
                content: textSeg,
                order,
              },
            });
            order++;
          }
        }

        // code block (remove backticks)
        const codeContent = (match as RegExpMatchArray)[0].replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
        await tx.snippet.create({
          data: {
            type: SnippetType.CODE,
            messageId: chatMessage.id,
            content: codeContent,
            order,
          },
        });
        order++;
        lastIndex = end;
      }

      // remaining text after last code block
      if (lastIndex < response.length) {
        const tail = response.slice(lastIndex).trim();
        if (tail) {
          await tx.snippet.create({
            data: {
              type: SnippetType.TEXT,
              messageId: chatMessage.id,
              content: tail,
              order,
            },
          });
        }
      }
    }
  });

  return res.status(200).json({ message: "Chat updated successfully" });
};

// Utility helpers
function cleanBackticks(str: string) {
  return str.replace(/```/g, '').trim();
}

function isProbablyCode(text: string): boolean {
  const patterns = [/setcpm\s*\(/, /sound\s*\(/, /note\s*\(/, /stack\s*\(/];
  return patterns.some((p) => p.test(text));
}
