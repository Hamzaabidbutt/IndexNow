import { db } from "@/lib/db";
import { verifyDomain } from "@/lib/services/verification";
import { getIndexNowKey } from "@/lib/services/indexnow";
import { apiError, audit, guard, json } from "@/lib/api";

/** GET returns the verification instructions; POST runs the check. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { user, errorResponse } = await guard(req);
  if (errorResponse || !user) return errorResponse!;

  const project = await db.project.findFirst({ where: { id: params.id, userId: user.id } });
  if (!project) return apiError(404, "Project not found");

  return json({
    verified: project.verified,
    method: project.verificationMethod,
    options: {
      file: {
        path: `https://${project.host}/indexjet-verify-${project.verificationToken}.txt`,
        content: project.verificationToken,
      },
      dns: { record: "TXT", name: project.host, value: `indexjet-verify=${project.verificationToken}` },
      indexnow: {
        path: `https://${project.host}/${getIndexNowKey()}.txt`,
        content: getIndexNowKey(),
        note: "Hosting this file also unlocks IndexNow submissions for the domain.",
      },
    },
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { user, errorResponse } = await guard(req, { limit: 20 });
  if (errorResponse || !user) return errorResponse!;

  const project = await db.project.findFirst({ where: { id: params.id, userId: user.id } });
  if (!project) return apiError(404, "Project not found");

  const outcome = await verifyDomain(project.host, project.verificationToken);
  if (outcome.verified) {
    await db.project.update({
      where: { id: project.id },
      data: { verified: true, verificationMethod: outcome.method!, verifiedAt: new Date() },
    });
    await audit(user.id, "project.verify", { host: project.host, method: outcome.method }, req);
  }
  return json(outcome, { status: outcome.verified ? 200 : 422 });
}
