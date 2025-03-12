import { KycStatus } from "@prisma/client";
import { prisma } from "../utils/db";

export async function attachUser(ctx: any, next: any) {
  try {
    ctx.user = await prisma.user.findFirst({
      where: {
        chatId: ctx.from.id.toString(),
      },
      include: {
        Ref: {
          where: {
            status: KycStatus.APPROVED,
          },
        },
      },
    });
  } catch (error) {
    ctx.user = undefined;
  }

  return next();
}
