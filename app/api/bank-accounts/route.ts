export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const accounts = await prisma.bankAccount.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(accounts);
}

export async function PATCH(request: Request) {
  const { id, currentBalance } = await request.json();
  const account = await prisma.bankAccount.update({
    where: { id },
    data: { currentBalance },
  });
  return NextResponse.json(account);
}
