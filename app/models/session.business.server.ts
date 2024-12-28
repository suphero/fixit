import db from "../db.server";

export function deleteSession(shop: string) {
  return db.session.deleteMany({ where: { shop } });
}
