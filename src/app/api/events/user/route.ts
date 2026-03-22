import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mine = searchParams.get("mine") === "true";

  if (mine) {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const events = await prisma.userEvent.findMany({
      where: { authorId: user.id },
      include: { building: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ events });
  }

  const events = await prisma.userEvent.findMany({
    where: { status: "APPROVED", startTime: { gte: new Date() } },
    include: {
      building: { select: { name: true } },
      author: { select: { name: true } },
    },
    orderBy: { startTime: "asc" },
  });
  return NextResponse.json({ events });
}
