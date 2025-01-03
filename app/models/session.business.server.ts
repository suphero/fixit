import db from "../db.server";

export function deleteSession(shop: string) {
  return db.session.deleteMany({ where: { shop } });
}

export function getAllSessions() {
  return db.session.findMany();
}

export function updateScope(id: string, current: string[]) {
  return db.session.update({
    where: { id },
    data: {
      scope: current.toString(),
    },
  });
}
