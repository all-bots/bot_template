import { Scenes } from "telegraf";
import {
  getCurrency,
  getPrice,
  numberWithCommas,
  sendQRCode,
} from "../../utils";
import env from "../../utils/env";
import { BTN, FLOW_BUY } from "../../utils/consts";
import {
  backKeyboard,
  currencyKeyboard,
  // makeButton,
  menuKeyboard,
  minePackageKeyboard,
} from "../keyboard";
import { TransactionStatus, TransactionType } from "@prisma/client";
import { prisma } from "../../utils/db";
import { sendGenerateWalletMessage } from "../../utils/redis";

export function flowBuy() {
  const flow = new Scenes.WizardScene(
    FLOW_BUY,
    async (ctx: any) => {
      try {
        await ctx.replyWithPhoto(
          { source: "miningPackage.jpg" },
          backKeyboard.reply(),
        );
        await ctx.reply("Mining Package", minePackageKeyboard.inline());
        return ctx.wizard.next();
      } catch (error) {
        console.log(error);
      }
    },
    async (ctx: any) => {
      try {
        if (ctx.message?.text == BTN.BACK) {
          await ctx.reply("Menu", menuKeyboard.reply());
          return ctx.scene.leave();
        }
        if (!ctx.update.callback_query) return;
        await ctx.deleteMessage();
        let option = ctx.update.callback_query.data;
        if (option == BTN.OTHER) {
          ctx.scene.state.otherOption = true;
          await ctx.reply("Nhập số tiền tối thiểu $10", backKeyboard.reply());
          return ctx.wizard.next();
        }
        ctx.scene.state.package = Number(
          ctx.update.callback_query.data.slice(1).replaceAll(".", ""),
        );
        await ctx.reply("Choose Deposit Method", currencyKeyboard.inline());
        return ctx.wizard.next();
      } catch (error: any) {
        ctx.reply(error.message, menuKeyboard.reply());
        return await ctx.scene.leave();
      }
    },
    async (ctx: any) => {
      try {
        if (ctx.message?.text == BTN.BACK) {
          await ctx.reply("Menu", menuKeyboard.reply());
          return await ctx.scene.leave();
        }
        if (ctx.scene.state.otherOption) {
          let text = ctx.message.text;
          if (text == BTN.BACK) {
            await ctx.reply("Menu", menuKeyboard.reply());
            return ctx.scene.leave();
          }
          if (isNaN(text)) {
            return await ctx.reply("Amount invalid");
          }
          ctx.scene.state.package = Number(text);
          if (ctx.scene.state.package < 10) {
            return await ctx.reply("Số tiền tối thiểu $10");
          }
          await ctx.reply("Choose Deposit Method", currencyKeyboard.inline());
          return ctx.wizard.next();
        } else {
          if (await handleSelectCurrency(ctx)) {
            return ctx.scene.leave();
          }
        }
      } catch (error: any) {
        ctx.reply(error.message, menuKeyboard.reply());
        return await ctx.scene.leave();
      }
    },
    async (ctx: any) => {
      if (ctx.message?.text == BTN.BACK) {
        return await ctx.reply("Menu", menuKeyboard.reply());
      }
      try {
        if (ctx.scene.state.otherOption) {
          if (await handleSelectCurrency(ctx)) {
            return ctx.scene.leave();
          }
        } else {
          await ctx.reply(
            "🎉Congratulations! You have successfully upgraded the mining package.",
            menuKeyboard.reply(),
          );
          return ctx.scene.leave();
        }
      } catch (error: any) {
        ctx.reply(error.message);
      }
    },
  );
  return flow;
}

async function handleSelectCurrency(ctx: any) {
  try {
    if (!ctx.update.callback_query) return false;
    await ctx.deleteMessage();
    let currencyOption = ctx.update.callback_query.data;
    const { symbol, service } = getCurrency(currencyOption);
    if (!symbol || !service) return;
    let currency = await prisma.currency.findFirst({
      where: {
        symbol,
        crypto_service: service,
      },
    });
    if (!currency) {
      await ctx.reply("Missing currency", currencyKeyboard.inline());
      return false;
    }
    ctx.scene.state.currencyId = currency.id;
    ctx.scene.state.currency = currency.symbol;

    if (["BUSD", "USDT"].includes(ctx.scene.state.currency)) {
      ctx.scene.state.amountToken = ctx.scene.state.package;
    } else {
      let price = await getPrice(ctx.scene.state.currency);
      ctx.scene.state.amountToken = Number(ctx.scene.state.package) / price;
      ctx.scene.state.amountToken =
        Math.ceil(ctx.scene.state.amountToken * 1e5) / 1e5;
    }
    let wallet = ctx.user.Wallet;
    let total = 10;
    if (!wallet) {
      while (!wallet && total > 0) {
        await sendGenerateWalletMessage(ctx.user.id);
        await new Promise((r) => setTimeout(r, 4000));
        wallet = await prisma.wallet.findFirst({
          where: { userId: ctx.user.id },
        });
        total--;
      }
    }
    if (!wallet) {
      await ctx.reply("Can not find wallet", menuKeyboard.reply());
      return false;
    }
    ctx.scene.state.address = wallet.address;
    await prisma.transaction.create({
      data: {
        amount: Math.ceil(ctx.scene.state.amountToken / env.PRICE_TOKEN),
        amountToken: ctx.scene.state.amountToken,
        package: ctx.scene.state.package,
        type: TransactionType.BUY_PACKAGE,
        address: wallet.address,
        currencyId: ctx.scene.state.currencyId,
        userId: ctx.user.id,
        status: TransactionStatus.SUBMITTED,
      },
    });
    await ctx.reply(
      `
Transfer ${numberWithCommas(ctx.scene.state.amountToken)} ${
        ctx.scene.state.currency
      } to wallet address:

${wallet.address}

The system will automatically confirm your transaction.
`,
      menuKeyboard.reply(),
    );
    await sendQRCode(ctx, wallet.address);

    return true;
  } catch (error: any) {
    ctx.reply(error.message, currencyKeyboard.inline());
    return false;
  }
}
