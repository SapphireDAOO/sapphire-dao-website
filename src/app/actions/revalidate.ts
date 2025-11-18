"use server";
import { revalidatePath } from "next/cache";

export async function revalidatePathAction(
  path: string,
  type: "page" | "layout" = "page"
) {
  try {
    revalidatePath(path, type);
    return { success: true };
  } catch (err) {
    console.error("Failed to revalidate path:", err);
    return { success: false, error: (err as Error).message };
  }
}
