import { z } from "zod";
import { MessageType } from "@prisma/client";

export const updateChatSchema = z.object({
  messageId: z.string().min(1, "Message ID is required"),
  prompt: z.string(),
});

export const deleteChatSchema = z.object({
  id: z.string().min(1, "Chat ID is required"),
});

export const shareChatSchema = z.object({
  id: z.string().min(1, "Chat ID is required"),
});

export const unshareChatSchema = z.object({
  id: z.string().min(1, "Chat ID is required"),
});

export const generateResponseFromPromptSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
});

// output
const getChatResponseSchema = z.object({
  message: z.string(),
  data: z.object({
    messages: z.array(
      z.object({
        id: z.string(),
        content: z.string(),
        createdAt: z.date(),
        from: z.enum([MessageType.USER, MessageType.BOT]),
      })
    ),
  }),
});

const getChatErrorResponseSchema = z.object({
  error: z.string(),
});

const createChatResponseSchema = z.object({
  message: z.string(),
  data: z.object({
    id: z.string(),
  }),
});

const createChatErrorResponseSchema = z.object({
  message: z.string(),
  data: z.object({
    id: z.string(),
  }),
});

const updateChatResponseSchema = z.object({
  message: z.string(),
});

const updateChatErrorResponseSchema = z.object({
  error: z.string(),
});

const deleteChatResponseSchema = z.object({
  message: z.string(),
});

const deleteChatErrorResponseSchema = z.object({
  error: z.string(),
});

const shareChatResponseSchema = z.object({
  message: z.string(),
});

const shareChatErrorResponseSchema = z.object({
  error: z.string(),
});

const unshareChatResponseSchema = z.object({
  message: z.string(),
});

const unshareChatErrorResponseSchema = z.object({
  error: z.string(),
});

export type GetChatResponseData = z.infer<typeof getChatResponseSchema>;
export type CreateChatResponseData = z.infer<typeof createChatResponseSchema>;
export type UpdateChatResponseData = z.infer<typeof updateChatResponseSchema>;
export type DeleteChatResponseData = z.infer<typeof deleteChatResponseSchema>;
export type ShareChatResponseData = z.infer<typeof shareChatResponseSchema>;
export type UnshareChatResponseData = z.infer<typeof unshareChatResponseSchema>;

export type GetChatErrorResponseData = z.infer<
  typeof getChatErrorResponseSchema
>;
export type CreateChatErrorResponseSchema = z.infer<
  typeof createChatErrorResponseSchema
>;
export type UpdateChatErrorResponseData = z.infer<
  typeof updateChatErrorResponseSchema
>;
export type DeleteChatErrorResponseData = z.infer<
  typeof deleteChatErrorResponseSchema
>;
export type ShareChatErrorResponseData = z.infer<
  typeof shareChatErrorResponseSchema
>;
export type UnshareChatErrorResponseData = z.infer<
  typeof unshareChatErrorResponseSchema
>;
