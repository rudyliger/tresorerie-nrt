import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const entities = await prisma.entity.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(entities);
}
