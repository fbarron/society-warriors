import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ContactPayload = {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
};

function sanitizeInput(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getSupabaseHost() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    return "unknown";
  }

  try {
    return new URL(url).host;
  } catch {
    return "invalid-url";
  }
}

export async function POST(request: Request) {
  let body: ContactPayload;

  try {
    body = (await request.json()) as ContactPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 },
    );
  }

  const name = sanitizeInput(body.name);
  const email = sanitizeInput(body.email);
  const subject = sanitizeInput(body.subject);
  const message = sanitizeInput(body.message);

  if (!name || !email || !subject || !message) {
    return NextResponse.json(
      { error: "All fields are required." },
      { status: 400 },
    );
  }

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();
    const supabaseHost = getSupabaseHost();
    const { error } = await supabase.from("contact_messages").insert({
      name,
      email,
      subject,
      message,
    });

    if (error) {
      console.error("Contact form insert failed", {
        supabaseHost,
        code: error.code,
        message: error.message,
        details: error.details,
      });

      if (error.code === "42P01") {
        return NextResponse.json(
          { error: "Contact form is not configured yet. Please try again later." },
          { status: 500 },
        );
      }

      if (error.code === "42501") {
        return NextResponse.json(
          { error: "Contact form permissions are not configured yet." },
          { status: 500 },
        );
      }

      return NextResponse.json(
        { error: "Unable to send your message right now." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        ...(process.env.NODE_ENV !== "production" ? { projectHost: supabaseHost } : {}),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Contact form server error", error);

    return NextResponse.json(
      { error: "Server error while sending message." },
      { status: 500 },
    );
  }
}
