import { createClient } from "@/lib/supabase/server";
import { markNotificationAsRead } from "@/lib/supabase/queries";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: notificationId } = await params;
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify the notification belongs to the user
    const { data: notification, error: fetchError } = await supabase
      .from("notifications")
      .select("id, user_id")
      .eq("id", notificationId)
      .single();

    if (fetchError || !notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    if (notification.user_id !== user.id) {
      return NextResponse.json(
        { error: "Cannot update other users' notifications" },
        { status: 403 }
      );
    }

    // Mark as read
    const { data: updatedNotification, error } =
      await markNotificationAsRead(notificationId);

    if (error) {
      throw error;
    }

    return NextResponse.json(
      {
        success: true,
        notification: updatedNotification,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return NextResponse.json(
      { error: "Failed to mark notification as read" },
      { status: 500 }
    );
  }
}
