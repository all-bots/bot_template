import { BTN, FLOW_CONFIG_SEEDING } from "../../utils/consts";
import { backKeyboard, menuAdminKeyboard } from "../keyboard";
import { getGroupName } from "./updateSeeding";
import { redis } from "../../utils/redis";
import { Scenes } from "telegraf";

export function flowConfigSeeding() {
  const flow = new Scenes.WizardScene(
    FLOW_CONFIG_SEEDING,
    async (ctx: any) => {
      try {
        await ctx.reply("Nhập số giây tối thiểu seeding", backKeyboard.reply());
        return ctx.wizard.next();
      } catch (error) {
        ctx.reply(error.message, menuAdminKeyboard.reply());
        return ctx.scene.leave();
      }
    },
    async (ctx: any) => {
      try {
        if (ctx.message?.text == BTN.BACK) {
          await ctx.reply("Menu", menuAdminKeyboard.reply());
          return ctx.scene.leave();
        }
        if (isNaN(ctx.message?.text)) {
          return await ctx.reply("Điền số không hợp lệ");
        }
        let time = Number(ctx.message?.text || "0");
        if (time <= 0) {
          return await ctx.reply("Số giây phải > 0");
        }
        ctx.scene.state.timeMin = time;
        await ctx.reply("Nhập số giây tối đa seeding", backKeyboard.reply());
        return ctx.wizard.next();
      } catch (error: any) {
        ctx.reply(error.message, menuAdminKeyboard.reply());

        return ctx.scene.leave();
      }
    },
    async (ctx: any) => {
      try {
        if (ctx.message?.text == BTN.BACK) {
          await ctx.reply("Menu", menuAdminKeyboard.reply());
          return ctx.scene.leave();
        }
        if (isNaN(ctx.message?.text)) {
          return await ctx.reply("Điền số không hợp lệ");
        }
        let time = Number(ctx.message?.text || "0");
        if (time <= 0) {
          return await ctx.reply("Số giây phải > 0");
        }
        if (time <= ctx.scene.state.timeMin) {
          return await ctx.reply(
            "Số giây tối đa phải lớn hơn số giây tối thiểu",
          );
        }

        await redis.set(
          "TIME_" + getGroupName(),
          JSON.stringify({
            timeMin: ctx.scene.state.timeMin,
            timeMax: time,
          }),
        );
        await ctx.reply("Config time seeding done", menuAdminKeyboard.reply());
      } catch (error: any) {
        ctx.reply(error.message, menuAdminKeyboard.reply());
      }

      return ctx.scene.leave();
    },
  );
  return flow;
}
