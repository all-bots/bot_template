import { Scenes } from "telegraf";
import { BTN, FLOW_CONFIG_SWAP, REDIS_KEY } from "../../utils/consts";
import { backKeyboard, menuAdminKeyboard } from "../keyboard";
import { redis } from "../../utils/redis";

export function flowConfigSwap() {
  const flow = new Scenes.WizardScene(
    FLOW_CONFIG_SWAP,
    async (ctx: any) => {
      try {
        await ctx.reply("Nhập giá", backKeyboard.reply());
        return ctx.wizard.next();
      } catch (error) {
        await ctx.reply(error.message, menuAdminKeyboard.reply());
      }
    },
    async (ctx: any) => {
      try {
        if (ctx.message?.text == BTN.BACK) {
          await ctx.reply("Menu", menuAdminKeyboard.reply());
          return ctx.scene.leave();
        }

        if (isNaN(ctx.message.text)) {
          return await ctx.reply("Giá không hợp lệ");
        }
        ctx.scene.state.price = ctx.message.text;
        await ctx.reply("Nhập số tiền (USD) tối thiểu:");
        return ctx.wizard.next();
      } catch (error: any) {
        await ctx.reply(error.message, menuAdminKeyboard.reply());
        return ctx.scene.leave();
      }
    },
    async (ctx: any) => {
      try {
        if (ctx.message?.text == BTN.BACK) {
          await ctx.reply("Menu", menuAdminKeyboard.reply());
          return ctx.scene.leave();
        }

        if (isNaN(ctx.message.text)) {
          return await ctx.reply("Số tiền (USD) tối thiểu không hợp lệ");
        }
        ctx.scene.state.amountMin = Number(ctx.message.text);
        await ctx.reply("Nhập số tiền (USD) tối đa:");
        return ctx.wizard.next();
      } catch (error: any) {
        await ctx.reply(error.message, menuAdminKeyboard.reply());
        return ctx.scene.leave();
      }
    },
    async (ctx: any) => {
      try {
        if (ctx.message?.text == BTN.BACK) {
          await ctx.reply("Menu", menuAdminKeyboard.reply());
          return ctx.scene.leave();
        }

        if (isNaN(ctx.message.text)) {
          return await ctx.reply("Số tiền (USD) tối đa không hợp lệ");
        }

        await redis.set(
          REDIS_KEY.CONFIG_AUTO_SWAP,
          JSON.stringify({
            // amount: Number(ctx.scene.state.quantity),
            price: ctx.scene.state.price,
            amountMin: ctx.scene.state.amountMin,
            amountMax: Number(ctx.message.text),
          }),
        );
        await ctx.reply("Config done.", menuAdminKeyboard.reply());
        return ctx.scene.leave();
      } catch (error: any) {
        await ctx.reply(error.message, menuAdminKeyboard.reply());
        return ctx.scene.leave();
      }
    },
  );
  return flow;
}
