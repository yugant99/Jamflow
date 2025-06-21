import { Request, Response } from "express";
import { supabase, prisma } from "../resources";
import {
  signUpSchema,
  signInSchema,
  changePasswordSchema,
} from "../schema/auth";
import { User } from "@supabase/supabase-js";
import { z } from "zod";
import { jwtTokenSchema } from "../schema";

export async function validateJWT(token: string) {
  const validationResult = jwtTokenSchema.safeParse(token);
  if (!validationResult.success) {
    throw new Error("Invalid JWT Token");
  }

  const { data, error } = await supabase.auth.getUser(validationResult.data);
  if (error || !data) {
    throw new Error("Invalid JWT Token or user not found");
  }
  return data;
}
export async function signUp(req: Request, res: Response): Promise<Response> {
  const validationResult = signUpSchema.safeParse(req.body);
  if (!validationResult.success) {
    return res.status(400).json({
      error: validationResult.error.errors.map((e) => e.message).join(", "),
    });
  }

  const { username, email, password } = validationResult.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const { error: signUpError, data } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError || !data.user) {
        throw new Error(signUpError?.message || "Unexpected Error Occured.");
      }

      const user = await tx.user.create({
        data: {
          id: data.user.id,
          username,
          email,
        },
      });

      return user;
    });

    return res.status(201).json({
      message: "Signup successful!",
      user: {
        id: result.id,
        username: result.username,
        email: result.email,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}

export async function signIn(req: Request, res: Response): Promise<Response> {
  const validationResult = signInSchema.safeParse(req.body);
  if (!validationResult.success) {
    return res.status(400).json({
      error: validationResult.error.errors.map((e) => e.message).join(", "),
    });
  }

  const { email, password } = validationResult.data;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error("User not found.");
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session || !data.user) {
      throw new Error("Invalid credentials.");
    }

    return res.json({
      message: "Sign-in successful",
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
      access_token: data.session.access_token,
    });
  } catch (error) {
    console.error("Sign-in error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}

export async function test(req: Request, res: Response) {
  res.send("Works!");
}

export const changePassword = async (req: Request, res: Response) => {
  try {
    const { oldPassword, newPassword } = changePasswordSchema.parse(req.body);
    // @ts-ignore
    const user = req.user as User;
    if (!user.email) {
      throw new Error("Invalid credentials.");
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: oldPassword,
    });

    if (error || !data.session || !data.user) {
      throw new Error("Invalid credentials.");
    }
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      // @ts-ignore
      req.user.id as string,
      {
        password: newPassword,
      }
    );

    if (updateError) {
      return res.status(500).json({
        message: "Failed to change password",
        error: updateError.message,
      });
    }

    return res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: "Validation error", errors: error.errors });
    }

    console.error("Error changing password:", error);
    return res.status(500).json({ message: "Intrenal Server error" });
  }
};

export default async function logout(req: Request, res: Response) {
  try {
    // @ts-ignore
    const token = req.token as string;
    const { error } = await supabase.auth.admin.signOut(token);

    if (error) {
      return res.status(500).json({ message: "Error logging out" });
    }

    res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ message: "Unexpected error during logout" });
  }
}
