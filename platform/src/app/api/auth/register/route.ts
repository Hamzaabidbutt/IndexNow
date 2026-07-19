import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";
import { apiError, audit, guard, json } from "@/lib/api";

export async function POST(req: Request) {
  const { errorResponse } = await guard(req, { requireAuth: false, limit: 10, windowSec: 300 });
  if (errorResponse) return errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return apiError(400, parsed.error.issues[0]?.message ?? "Invalid input");

  const { name, email, password } = parsed.data;
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return apiError(409, "An account with this email already exists");

  const user = await db.user.create({
    data: { name, email, passwordHash: await hashPassword(password) },
  });
  await createSession(user.id, user.role);
  await audit(user.id, "auth.register", { email }, req);
  return json({ id: user.id, email: user.email, name: user.name }, { status: 201 });
}
