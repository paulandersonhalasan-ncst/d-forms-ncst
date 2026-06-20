// prisma/prisma.js
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	throw new Error("DATABASE_URL is not set. Set it before starting the app.");
}

export const prisma =
	globalForPrisma.prisma ||
	new PrismaClient({
		adapter: new PrismaPg({ connectionString }),
	});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;