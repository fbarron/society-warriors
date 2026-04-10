"use client";

import { useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { MoreVertical, Trash2, Shield } from "lucide-react";
import Image from "next/image";

const DEFAULT_AVATAR_URL = "/default-avatar.svg";

interface Member {
  id: string;
  user: {
    id: string;
    name: string;
    avatar_url: string;
  };
  role: "owner" | "admin" | "moderator" | "member";
  status: "active" | "pending";
}

interface SocietyMemberListProps {
  members: Member[];
  currentUserRole?: "owner" | "admin" | "moderator" | "member";
  communityId: string;
  onMemberRemoved?: (memberId: string) => void;
  onRoleChanged?: (memberId: string, newRole: string) => void;
}

export function SocietyMemberList({
  members,
  currentUserRole,
  communityId,
  onMemberRemoved,
  onRoleChanged,
}: SocietyMemberListProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const canManageMembers = currentUserRole === "owner" || currentUserRole === "admin";

  const handleRemoveMember = async (memberId: string) => {
    if (!canManageMembers) return;
    if (!confirm("Are you sure you want to remove this member?")) return;

    setLoading(memberId);
    try {
      // TODO: Wire this to the remove-member API route when available.
      console.debug("Remove member", { communityId, memberId });
      if (onMemberRemoved) {
        onMemberRemoved(memberId);
      }
    } finally {
      setLoading(null);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    if (!canManageMembers) return;

    setLoading(memberId);
    try {
      // TODO: Wire this to the role-change API route when available.
      console.debug("Change role", { communityId, memberId, newRole });
      if (onRoleChanged) {
        onRoleChanged(memberId, newRole);
      }
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
    <Card className="p-6">
      <h3 className="mb-4 text-lg font-semibold">Members ({members.length})</h3>
      <div className="space-y-3">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50"
          >
            <div className="flex flex-1 items-center gap-3">
              <Image
                src={member.user.avatar_url || DEFAULT_AVATAR_URL}
                alt={member.user.name}
                width={40}
                height={40}
                className="rounded-full"
              />
              <div className="flex-1">
                <p className="font-medium">{member.user.name}</p>
                <div className="mt-1 flex gap-2">
                  <span className={`rounded px-2 py-1 text-xs ${getRoleColor(member.role)}`}>
                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                  </span>
                  {member.status === "pending" && (
                    <span className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-800">
                      Pending
                    </span>
                  )}
                </div>
              </div>
            </div>

            {canManageMembers && member.role !== "owner" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" disabled={loading === member.id}>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => handleRoleChange(member.id, "admin")}
                    disabled={loading === member.id || member.role === "admin"}
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    Make Admin
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleRoleChange(member.id, "member")}
                    disabled={loading === member.id || member.role === "member"}
                  >
                    Make Member
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleRemoveMember(member.id)}
                    disabled={loading === member.id}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
