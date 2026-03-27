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
              <Image
                src={member.user.avatar_url || DEFAULT_AVATAR_URL}
                alt={member.user.name}
                width={40}
                height={40}
                className="rounded-full"
              />
    if (!confirm("Are you sure you want to remove this member?")) return;

    setLoading(memberId);
    try {
      // TODO: Implement remove member API
      // const response = await fetch(`/api/society/${communityId}/members/${memberId}`, {
      //   method: "DELETE",
      // });
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
      // TODO: Implement role change API
      // const response = await fetch(`/api/society/${communityId}/members/${memberId}/role`, {
      //   method: "PATCH",
      //   body: JSON.stringify({ role: newRole }),
      // });
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
      <h3 className="text-lg font-semibold mb-4">Members ({members.length})</h3>
      <div className="space-y-3">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
          >
            <div className="flex items-center gap-3 flex-1">
              {member.user.avatar_url ? (
                <Image
                  src={member.user.avatar_url}
                  alt={member.user.name}
                  width={40}
                  height={40}
                  className="rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200" />
              )}
              <div className="flex-1">
                <p className="font-medium">{member.user.name}</p>
                <div className="flex gap-2 mt-1">
                  <span className={`text-xs px-2 py-1 rounded ${getRoleColor(member.role)}`}>
                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                  </span>
                  {member.status === "pending" && (
                    <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
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
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => handleRoleChange(member.id, "admin")}
                    disabled={loading === member.id || member.role === "admin"}
                  >
                    <Shield className="w-4 h-4 mr-2" />
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
                    <Trash2 className="w-4 h-4 mr-2" />
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
