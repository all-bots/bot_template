import { Scenes } from "telegraf";
import { ethers } from "ethers";
import { numberWithCommas, saveMessage } from "../../utils";
import { BTN, FLOW_WITHDRAW } from "../../utils/consts";
import { backKeyboard, menuKeyboard } from "../keyboard";
import { prisma } from "../../utils/db";
import { TransactionType } from "@prisma/client";
import { getBalance } from "../menu";
import { sendNotifyAdmin } from "../../utils/bot";

export function flowWithdraw() {
  const flow = new Scenes.WizardScene(
    FLOW_WITHDRAW,
    async (ctx: any) => {
      try {
        const msg = await ctx.reply(
          "Please submit your BNB Smart Chain wallet address below:",
          backKeyboard.reply(),
        );
        await saveMessage(prisma, msg);
        return ctx.wizard.next();
      } catch (error: any) {
        const msg = await ctx.reply(error.message);
        await saveMessage(prisma, msg);
      }
    },
    async (ctx: any) => {
      try {
        if (ctx.message?.text == BTN.BACK) {
          const msg = await ctx.reply("Menu", menuKeyboard.reply());
          await saveMessage(prisma, msg);
          return ctx.scene.leave();
        }
        if (!ethers.isAddress(ctx.message.text)) {
          const msg = await ctx.reply(
            "❌ Invalid address: Please fill in the valid address",
            backKeyboard.reply(),
          );

          await saveMessage(prisma, msg);
          return;
        }

        let amount = await getBalance(ctx.user.id);
        if (amount <= 0) {
          const msg = await ctx.reply(
            "❌ Your balance is not enough to make a withdrawal.",
            menuKeyboard.reply(),
          );
          await saveMessage(prisma, msg);
          return ctx.scene.leave();
        }
        await prisma.transaction.create({
          data: {
            userId: ctx.user.id,
            amount,
            address: ctx.message.text,
            type: TransactionType.WITHDRAW,
          },
        });
        const msg = await ctx.reply(
          `Withdrawal request successful, token will be in your wallet within 12 hours.
          
Your X token will be unlocked on May 25, 2025.
`,
          menuKeyboard.reply(),
        );
        await saveMessage(prisma, msg);
        await sendNotifyAdmin(
          `
User ${ctx.user.firstName} ${ctx.user.lastName || ""} request withdraw: 
  - amount: ${numberWithCommas(amount)} 
  - to address: ${ctx.message.text}`,
        );
        return ctx.scene.leave();
      } catch (error: any) {
        const msg = await ctx.reply(error.message);
        await saveMessage(prisma, msg);
      }
    },
  );
  return flow;
}
