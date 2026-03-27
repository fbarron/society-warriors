import { createClient } from "@/lib/supabase/server";
import {
  getUserNotifications,
  getUnreadNotificationCount,
} from "@/lib/supabase/queries";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check for limit parameter (default 20)
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);

    // Get user notifications
    const { data: notifications, error } = await getUserNotifications(
      user.id,
      limit
    );

    if (error) {
      throw error;
    }

    // Get unread count
    const { count: unreadCount } = await getUnreadNotificationCount(user.id);

    return NextResponse.json(
      {
        success: true,
        notifications: notifications || [],
        count: notifications?.length || 0,
        unreadCount: unreadCount || 0,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}
