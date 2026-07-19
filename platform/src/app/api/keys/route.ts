import { db } from "@/lib/db";
import { generateApiKey } from "@/lib/auth";
import { apiKeySchema } from "@/lib/validation";
import { apiError, audit, guard, json } from "@/lib/api";

export async function GET(req: Request) {
  const { user, errorResponse } = await guard(req);
  if (errorResponse || !user) return errorResponse!;

  const keys = await db.apiKey.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, lastUsedAt: true, revokedAt: true, createdAt: true },
  });
  return json({ keys });
}

export async function POST(req: Request) {
  const { user, errorResponse } = await guard(req, { limit: 20 });
  if (errorResponse || !user) return errorResponse!;

  const parsed = apiKeySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "Key name is required (max 60 chars)");

  const active = await db.apiKey.count({ where: { userId: user.id, revokedAt: null } });
  if (active >= 10) return apiError(409, "Key limit reached (10 active). Revoke one first.");

  const { plaintext, keyHash, prefix } = generateApiKey();
  const key = await db.apiKey.create({
    data: { userId: user.id, name: parsed.data.name, keyHash, prefix },
  });
  await audit(user.id, "apikey.create", { name: key.name }, req);
  // The plaintext key is returned exactly once
  return json({ id: key.id, name: key.name, prefix, key: plaintext }, { status: 201 });
}

export async function DELETE(req: Request) {
  const { user, errorResponse } = await guard(req);
  if (errorResponse || !user) return errorResponse!;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return apiError(400, "id query parameter required");

  const key = await db.apiKey.findFirst({ where: { id, userId: user.id } });
  if (!key) return apiError(404, "Key not found");

  await db.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  await audit(user.id, "apikey.revoke", { name: key.name }, req);
  return json({ ok: true });
}
