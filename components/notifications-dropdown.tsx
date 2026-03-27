"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";

interface Notification {
  id: string;
  action_type: string;
  message: string;
  read: boolean;
  created_at: string;
  target_id: string;
  target_type: string;
  actor: {
    id: string;
    name: string;
    avatar_url: string;
  };
}

export function NotificationsDropdown() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/notifications?limit=3");

      if (response.status === 401 || response.status === 403) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch notifications");
      }

      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Keep unread badge updated even before opening the dropdown.
  useEffect(() => {
    fetchNotifications();

    const intervalId = setInterval(() => {
      fetchNotifications();
    }, 30000);

    const onFocus = () => {
      fetchNotifications();
    };

    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "PATCH",
      });

      if (response.status === 401 || response.status === 403) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }

      if (!response.ok) throw new Error("Failed to mark as read");

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await handleMarkAsRead(notification.id);
    }

    if (
      notification.target_type === "community_pending_posts" &&
      notification.target_id
    ) {
      router.push(`/communities/${notification.target_id}/admin/pending-posts`);
      setOpen(false);
      return;
    }

    if (notification.target_type === "post" && notification.target_id) {
      router.push("/protected");
      setOpen(false);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <div className="px-4 py-2">
          <h3 className="font-semibold text-sm">Notifications</h3>
        </div>
        <DropdownMenuSeparator />

        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            Loading...
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            No notifications yet
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className="px-4 py-3 cursor-pointer hover:bg-gray-50 flex flex-col gap-1"
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start gap-2 w-full">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(notification.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {!notification.read && (
                    <Check className="w-4 h-4 text-blue-500 flex-shrink-0 mt-1" />
                  )}
                  {notification.read && (
                    <CheckCheck className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
