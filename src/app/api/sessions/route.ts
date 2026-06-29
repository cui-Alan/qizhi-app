import { NextRequest, NextResponse } from "next/server";
import { createServer } from "@/lib/supabase/server";

// GET /api/sessions - List all sessions for current user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServer();
    
    const { data: sessions, error } = await supabase
      .from("sessions")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sessions });
  } catch (err) {
    console.error("GET /api/sessions error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/sessions - Create a new session
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServer();
    const body = await request.json();
    
    const { title, model_id } = body;

    const { data: session, error } = await supabase
      .from("sessions")
      .insert({
        title: title || "新对话",
        model_id: model_id || "gpt-4o",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ session }, { status: 201 });
  } catch (err) {
    console.error("POST /api/sessions error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
