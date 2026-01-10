import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import type { SessionStorage } from "@shopify/shopify-app-remix/server";
import type { Session } from "@shopify/shopify-api";
import type { PrismaClient } from "@prisma/client";
import prisma from "./db.server";

// Wrap PrismaSessionStorage to add logging
export class LoggingSessionStorage implements SessionStorage {
  private storage: PrismaSessionStorage<PrismaClient>;

  constructor() {
    this.storage = new PrismaSessionStorage<PrismaClient>(prisma);
  }

  async storeSession(session: Session): Promise<boolean> {
    console.log('[SessionStorage] Storing session:', {
      id: session.id,
      shop: session.shop,
      isOnline: session.isOnline,
      scope: session.scope,
    });
    const result = await this.storage.storeSession(session);
    console.log('[SessionStorage] Session stored:', result);
    return result;
  }

  async loadSession(id: string): Promise<Session | undefined> {
    console.log('[SessionStorage] Loading session with ID:', id);
    const session = await this.storage.loadSession(id);
    if (session) {
      console.log('[SessionStorage] Session found:', {
        id: session.id,
        shop: session.shop,
        isOnline: session.isOnline,
      });
    } else {
      console.log('[SessionStorage] Session not found for ID:', id);
    }
    return session;
  }

  async deleteSession(id: string): Promise<boolean> {
    console.log('[SessionStorage] Deleting session with ID:', id);
    const result = await this.storage.deleteSession(id);
    console.log('[SessionStorage] Session deleted:', result);
    return result;
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    console.log('[SessionStorage] Deleting sessions with IDs:', ids);
    const result = await this.storage.deleteSessions(ids);
    console.log('[SessionStorage] Sessions deleted:', result);
    return result;
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    console.log('[SessionStorage] Finding sessions for shop:', shop);
    const sessions = await this.storage.findSessionsByShop(shop);
    console.log('[SessionStorage] Found sessions:', sessions.length);
    return sessions;
  }
}
