"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { forgotPasswordSchema, loginSchema } from "@/lib/validations/auth";
import { getErrorMessage } from "@/lib/utils";

export type ActionResult = {
  success: boolean;
  message?: string;
};

export async function loginAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    rememberMe: formData.get("rememberMe") === "on",
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message || "Invalid input" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      return { success: false, message: error.message };
    }
  } catch (error) {
    return { success: false, message: getErrorMessage(error, "Login failed") };
  }

  redirect("/dashboard");
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
