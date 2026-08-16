"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { getErrorMessage } from "@/lib/utils";

export type ActionResult = {
  success: boolean;
  message?: string;
};

const RECENT_AUTH_COOKIE = "society_recent_auth";

export async function confirmPasswordAction(password: string): Promise<ActionResult> {
  if (!password || password.length < 6) return { success: false, message: "Enter your current password" };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return { success: false, message: "Your session has expired. Please sign in again." };
    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password });
    if (error) return { success: false, message: "Incorrect password" };
    (await cookies()).set(RECENT_AUTH_COOKIE, `${user.id}:${Date.now()}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 10 * 60,
      priority: "high",
    });
    return { success: true, message: "Identity confirmed for 10 minutes" };
  } catch (error) {
    return { success: false, message: getErrorMessage(error, "Unable to confirm password") };
  }
}

export async function forgotPasswordAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message || "Invalid email" };
  }

  try {
    const supabase = await createClient();
    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login`;
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo,
    });
    if (error) return { success: false, message: error.message };
    return {
      success: true,
      message: "Password reset link sent. Check your email.",
    };
  } catch (error) {
    return { success: false, message: getErrorMessage(error, "Unable to send reset email") };
  }
}
