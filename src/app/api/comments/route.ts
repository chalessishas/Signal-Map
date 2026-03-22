import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase/server";

const createSchema = z
  .object({
    content: z.string().min(1).max(1000),
    eventId: z.string().optional(),
    buildingId: z.string().optional(),
    parentId: z.string().optional(),
  })
  .refine((d) => d.eventId || d.buildingId, {
    message: "Must specify eventId or buildingId",
  });

const authorSelect = { name: true, avatarUrl: true } as const;

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.userProfile.upsert({
    where: { id: user.id },
    update: {},
    create: {
      id: user.id,
      email: user.email!,
      name: user.user_metadata?.name ?? null,
      avatarUrl: user.user_metadata?.avatar_url ?? null,
    },
  });

  const comment = await prisma.comment.create({
    data: { ...parsed.data, authorId: user.id },
    include: { author: { select: authorSelect } },
  });

  return NextResponse.json({ comment }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const eventId = searchParams.get("eventId");
  const buildingId = searchParams.get("buildingId");

  if (!eventId && !buildingId) {
    return NextResponse.json({ error: "Specify eventId or buildingId" }, { status: 400 });
  }

  const comments = await prisma.comment.findMany({
    where: {
      ...(eventId ? { eventId } : {}),
      ...(buildingId ? { buildingId } : {}),
      parentId: null,
    },
    include: {
      author: { select: authorSelect },
      replies: {
        include: { author: { select: authorSelect } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ comments });
}
