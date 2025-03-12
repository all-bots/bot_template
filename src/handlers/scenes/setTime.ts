import { Scenes } from "telegraf";
import { BTN, FLOW_SET_TIME } from "../../utils/consts";
import { backKeyboard, menuAdminKeyboard } from "../keyboard";
import { prisma } from "../../utils/db";
import { ConfigType } from "@prisma/client";

export function flowSetTime() {
  const flow = new Scenes.WizardScene(
    FLOW_SET_TIME,
    async (ctx: any) => {
      try {
        await ctx.reply("Điền số phút", backKeyboard.reply());
        return ctx.wizard.next();
      } catch (error) {
        ctx.reply(error.message, menuAdminKeyboard.reply());
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
        if (time < 0) {
          return await ctx.reply("Số phút phải > 0");
        }
        let data = await prisma.config.findFirst({
          where: {
            type: ConfigType.AUTO_FORWARD,
          },
        });
        if (data) {
          await prisma.config.updateMany({
            where: {
              type: ConfigType.AUTO_FORWARD,
            },
            data: {
              is_enable: true,
              time,
            },
          });
        } else {
          await prisma.config.create({
            data: {
              type: ConfigType.AUTO_FORWARD,
              is_enable: true,
              time,
            },
          });
        }
        ctx.reply("Set time thành công", menuAdminKeyboard.reply());
        return ctx.scene.leave();
      } catch (error: any) {
        ctx.reply(error.message, menuAdminKeyboard.reply());

        return ctx.scene.leave();
      }
    },
  );
  return flow;
}
