import { Scenes } from "telegraf";
import { FLOW_CHECK_ADDRESS } from "../../utils/consts";
import { menuAdminKeyboard, startKeyboard } from "../keyboard";
import { prisma } from "../../utils/db";

export function flowCheckAddress() {
  const flow = new Scenes.WizardScene(
    FLOW_CHECK_ADDRESS,
    async (ctx: any) => {
      try {
        await ctx.reply("Nhập địa chỉ ví", startKeyboard.remove());
        return ctx.wizard.next();
      } catch (error) {
        console.log(error);
      }
    },
    async (ctx: any) => {
      try {
        const address = ctx.message.text.toLowerCase();
        let transactions = await prisma.transaction.findMany({
          distinct: ["userId"],
          where: {
            address: {
              mode: "insensitive",
              equals: address,
            },
          },
          select: {
            userId: true,
          },
        });

        if (transactions.length == 0) {
          await ctx.reply(
            "Không có user nào rút về ví này",
            menuAdminKeyboard.reply(),
          );
          return ctx.scene.leave();
        }
        const users = await prisma.user.findMany({
          where: {
            id: {
              in: transactions.map((order) => order.userId),
            },
          },
          select: {
            username: true,
            firstName: true,
            lastName: true,
            chatId: true,
          },
        });
        let msg = users.reduce((msg, user) => {
          let username = user?.username || "";
          return `${msg}
   - ${user?.firstName || ""} ${user?.lastName || ""}${
            username ? ": @" + username : ""
          } - ${user.chatId}`;
        }, "");
        await ctx.reply(
          `Các user rút về ví: ${msg}`,
          menuAdminKeyboard.reply(),
        );
        return ctx.scene.leave();
      } catch (error) {
        ctx.reply(error.message, menuAdminKeyboard.reply());
        return ctx.scene.leave();
      }
    },
  );
  return flow;
}
