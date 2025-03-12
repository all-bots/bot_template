import { Scenes } from "telegraf";
import { FLOW_CHECK_USER } from "../../utils/consts";
import { menuAdminKeyboard, startKeyboard } from "../keyboard";
import { prisma } from "../../utils/db";
import { PrismaClient, TransactionType } from "@prisma/client";
import { User, WalletChangeType } from "@prisma/client";
import { numberWithCommas } from "../../utils";

async function getTotalReceived(prisma: PrismaClient, userId: string) {
  let walletChange = await prisma.walletChange.findMany({
    where: { userId },
  });
  let total = walletChange
    .filter(
      (item) =>
        item.type == WalletChangeType.MINE_TOKEN ||
        item.type == WalletChangeType.REFFERAL_MINE_TOKEN,
    )
    .reduce((total, item) => {
      return total + item.amount;
    }, 0);
  let withdrawn = walletChange
    .filter((item) => item.type == WalletChangeType.WITHDRAW)
    .reduce((total, item) => {
      return total + item.amount;
    }, 0);
  return {
    total,
    withdrawn: Math.abs(withdrawn),
  };
}
async function getTotalRefReceived(prisma: PrismaClient, users: User[]) {
  let total = {
    total: 0,
    withdrawn: 0,
  };
  for (let user of users) {
    let data = await getTotalReceived(prisma, user.id);
    total.total += data.total;
    total.withdrawn += data.withdrawn;
  }
  return total;
}

async function getWalletWithdraw(prisma: PrismaClient, userId: string) {
  let transactions = await prisma.transaction.findMany({
    distinct: ["address"],
    where: { userId, type: TransactionType.WITHDRAW },
  });
  return transactions.map((transaction) => transaction.address);
}

export function flowCheckUser() {
  const flow = new Scenes.WizardScene(
    FLOW_CHECK_USER,
    async (ctx: any) => {
      try {
        await ctx.reply("Nhập username của user", startKeyboard.remove());
        return ctx.wizard.next();
      } catch (error) {
        console.log(error);
      }
    },
    async (ctx: any) => {
      try {
        const username = ctx.message.text;
        let user = await prisma.user.findFirst({
          where: {
            username: username,
          },
          include: {
            Ref: true,
          },
        });
        if (!user) {
          await ctx.reply(
            "Username không tồn tại trong hệ thống",
            menuAdminKeyboard.reply(),
          );
          return ctx.scene.leave();
        }
        const [totalUser, totalRef, wallets] = await Promise.all([
          getTotalReceived(prisma, user.id),
          getTotalRefReceived(prisma, user.Ref),
          getWalletWithdraw(prisma, user.id),
        ]);
        await ctx.reply(
          `
1. tổng số X đã rút và chưa rút: ${numberWithCommas(totalUser.total)}
    - số tiền đã rút: ${numberWithCommas(totalUser.withdrawn)}
    - số tiền chưa rút: ${numberWithCommas(
      totalUser.total - totalUser.withdrawn,
    )}
2. tổng số rút và chưa rút của các ref: ${numberWithCommas(totalRef.total)}
    - số tiền đã rút: ${numberWithCommas(totalRef.withdrawn)}
    - số tiền chưa rút: ${numberWithCommas(totalRef.total - totalRef.withdrawn)}
3. tổng cái 1 và 2: ${numberWithCommas(totalUser.total + totalRef.total)}
    - số tiền đã rút: ${numberWithCommas(
      totalUser.withdrawn + totalRef.withdrawn,
    )}
    - số tiền chưa rút: ${numberWithCommas(
      totalUser.total -
        totalUser.withdrawn +
        totalRef.total -
        totalRef.withdrawn,
    )}
4. ví đã rút: ${wallets.reduce(
            (str, item) => `${str}
   - ${item}`,
            "",
          )}
5. ChatId: ${user.chatId}
`,
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
