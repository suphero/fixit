import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient;
}

const createPrismaClient = () => {
  console.log('[db.server] Creating new Prisma Client with DATABASE_URL:', process.env.DATABASE_URL?.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'));
  return new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ['error', 'warn'] : ['query', 'error', 'warn'],
  });
};

if (process.env.NODE_ENV !== "production") {
  if (!global.prisma) {
    global.prisma = createPrismaClient();
  }
} else {
  if (!global.prisma) {
    global.prisma = createPrismaClient();
  }
}

const prisma: PrismaClient = global.prisma;

// Test database connection on startup
prisma.$connect()
  .then(() => console.log('[db.server] Successfully connected to database'))
  .catch((error) => console.error('[db.server] Failed to connect to database:', error));

export default prisma;
