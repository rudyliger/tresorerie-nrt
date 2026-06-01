import { PrismaClient } from "@/app/generated/prisma";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

function createPrismaClient() {
  const adapter = new PrismaBetterSqlite3({ url: "file:./prisma/dev.db" });
  return new PrismaClient({ adapter });
}

declare global {
  // eslint-disable-next-line no-var
  var prisma: ReturnType<typeof createPrismaClient> | undefined;
}

const prisma = globalThis.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

export default prisma;
