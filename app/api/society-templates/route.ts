import { createClient } from "@/lib/supabase/server";
import { getSocietyTemplates } from "@/lib/supabase/queries";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { data: templates, error } = await getSocietyTemplates();

    if (error) {
      throw error;
    }

    return NextResponse.json(
      {
        success: true,
        templates: templates || [],
        count: templates?.length || 0,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching society templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch society templates" },
      { status: 500 }
    );
  }
}
