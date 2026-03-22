import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase/server";

const submitSchema = z
  .object({
    title: z.string().min(3).max(200),
    description: z.string().max(2000).optional(),
    startTime: z.coerce.date(),
    endTime: z.coerce.date().optional(),
    buildingId: z.string().optional(),
    locationText: z.string().max(200).optional(),
    category: z.string().max(50).optional(),
  })
  .refine((d) => d.startTime > new Date(), {
    message: "startTime must be in the future",
    path: ["startTime"],
  })
  .refine((d) => !d.endTime || d.endTime > d.startTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = submitSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.buildingId) {
    const building = await prisma.building.findUnique({
      where: { id: parsed.data.buildingId },
    });
    if (!building) {
      return NextResponse.json({ error: "Building not found" }, { status: 400 });
    }
  }

  await prisma.userProfile.upsert({
    where: { id: user.id },
    update: {},
    create: {
      id: user.id,
      email: user.email ?? "",
      name: user.user_metadata?.name ?? null,
      avatarUrl: user.user_metadata?.avatar_url ?? null,
    },
  });

  const event = await prisma.userEvent.create({
    data: {
      ...parsed.data,
      authorId: user.id,
      status: "PENDING",
    },
  });

  return NextResponse.json({ event }, { status: 201 });
}
