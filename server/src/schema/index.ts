import { z } from "zod";

export const jwtTokenSchema = z.string().min(1, "Token is required");
export const idSchema = z.object({ id: z.string().min(1, "Id is required") });
