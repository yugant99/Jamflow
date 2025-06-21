import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config();

export const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);
export const prisma = new PrismaClient();
