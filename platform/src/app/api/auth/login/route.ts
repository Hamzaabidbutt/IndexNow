import { db } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import { apiError, audit, guard, json } from "@/lib/api";

export async function POST(req: Request) {
  const { errorResponse } = await guard(req, { requireAuth: false, limit: 10, windowSec: 300 });
  if (errorResponse) return errorResponse;

  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "Invalid email or password");

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  // Constant-shape response for wrong email vs wrong password
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return apiError(401, "Invalid email or password");
  }

  await createSession(user.id, user.role);
  await audit(user.id, "auth.login", undefined, req);
  return json({ id: user.id, email: user.email, name: user.name, role: user.role });
}
