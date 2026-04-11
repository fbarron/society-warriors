"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MoreVertical, Shield, Trash2, UserCog } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const DEFAULT_AVATAR_URL = "/default-avatar.svg";

type MemberRole = "owner" | "admin" | "moderator" | "member";

export interface SocietyMember {
  id: string;
  user: {
    id: string;
    name: string | null;
    avatar_url: string | null;
  };
  role: MemberRole;
  status: "active" | "pending";
}

interface SocietyMemberListProps {
  members: SocietyMember[];
  currentUserId?: string;
  currentUserRole?: MemberRole;
  communityId: string;
  onMemberRemoved?: (memberId: string) => void;
  onRoleChanged?: (memberId: string, newRole: string) => void;
}

export function SocietyMemberList({
  members,
  currentUserId,
  currentUserRole,
  communityId,
  onMemberRemoved,
  onRoleChanged,
}: SocietyMemberListProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [memberList, setMemberList] = useState<SocietyMember[]>(members);

  useEffect(() => {
    setMemberList(members);
  }, [members]);

  const canManageMembers = currentUserRole === "owner" || currentUserRole === "admin";

  const canModifyMember = (member: SocietyMember) => {
    if (!canManageMembers) {
      return false;
    }

    if (currentUserId === member.user.id || member.role === "owner") {
      return false;
    }

    if (currentUserRole === "admin" && member.role === "admin") {
      return false;
    }

    return true;
  };

  const getAssignableRoles = (member: SocietyMember): MemberRole[] => {
    if (!canModifyMember(member)) {
      return [];
    }

    const roles: MemberRole[] = ["member", "moderator"];

    if (currentUserRole === "owner") {
      roles.unshift("admin");
    }

    return roles;
  };

  const handleRemoveMember = async (memberUserId: string) => {
    if (!canManageMembers) return;
    if (!confirm("Are you sure you want to remove this member?")) return;

    setLoading(memberUserId);
    try {
      const response = await fetch(`/api/society/${communityId}/members/${memberUserId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(result?.error || "Failed to remove member.");
      }

      setMemberList((prev) => prev.filter((member) => member.user.id !== memberUserId));
      onMemberRemoved?.(memberUserId);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove member.";
      alert(message);
    } finally {
      setLoading(null);
    }
  };

  const handleRoleChange = async (memberUserId: string, newRole: MemberRole) => {
    if (!canManageMembers) return;

    setLoading(memberUserId);
    try {
      const response = await fetch(`/api/society/${communityId}/members/${memberUserId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(result?.error || "Failed to update role.");
      }

      setMemberList((prev) =>
        prev.map((member) =>
          member.user.id === memberUserId ? { ...member, role: newRole } : member,
        ),
      );
      onRoleChanged?.(memberUserId, newRole);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update role.";
      alert(message);
    } finally {
      setLoading(null);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-purple-100 text-purple-800";
      case "admin":
        return "bg-blue-100 text-blue-800";
      case "moderator":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card className="border-dashed p-6">
      <h3 className="mb-4 text-lg font-semibold">Manage members ({memberList.length})</h3>
      <div className="space-y-3">
        {memberList.map((member) => {
          const displayName = member.user.name?.trim() || `User ${member.user.id.slice(0, 8)}`;
          const roleOptions = getAssignableRoles(member);

          return (
            <div
              key={member.id}
              className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50"
            >
              <div className="flex flex-1 items-center gap-3">
                <Image
                  src={member.user.avatar_url || DEFAULT_AVATAR_URL}
                  alt={displayName}
                  width={40}
                  height={40}
                  className="rounded-full"
                />
                <div className="flex-1">
                  <p className="font-medium">{displayName}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <span className={`rounded px-2 py-1 text-xs ${getRoleColor(member.role)}`}>
                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                    </span>
                    {currentUserId === member.user.id && (
                      <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                        You
                      </span>
                    )}
                    {member.status === "pending" && (
                      <span className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-800">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {roleOptions.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={loading === member.user.id}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {roleOptions.map((role) => (
                      <DropdownMenuItem
                        key={`${member.user.id}-${role}`}
                        onClick={() => handleRoleChange(member.user.id, role)}
                        disabled={loading === member.user.id || member.role === role}
                      >
                        {role === "member" ? (
                          <UserCog className="mr-2 h-4 w-4" />
                        ) : (
                          <Shield className="mr-2 h-4 w-4" />
                        )}
                        Make {role.charAt(0).toUpperCase() + role.slice(1)}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuItem
                      onClick={() => handleRemoveMember(member.user.id)}
                      disabled={loading === member.user.id}
                      className="text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
