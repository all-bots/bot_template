import "dotenv/config";
import { Scenes } from "telegraf";
import { BTN, FLOW_UPDATE_SEEDING } from "../../utils/consts";
import { doneKeyboard, menuAdminKeyboard } from "../keyboard";
import fs from "fs";
import env from "../../utils/env";

export function flowUpdateSeeding() {
  const flow = new Scenes.WizardScene(
    FLOW_UPDATE_SEEDING,
    async (ctx: any) => {
      try {
        await ctx.reply(
          "Nhập content seeding mới. mỗi tin nhắn 1 dòng (Xong click Done)",
          doneKeyboard.reply(),
        );
        fs.writeFileSync(env.PATH_SEEDING, "");
        return ctx.wizard.next();
      } catch (error) {
        ctx.reply(error.message, menuAdminKeyboard.reply());
        return ctx.scene.leave();
      }
    },
    async (ctx: any) => {
      try {
        if (ctx.message?.text == BTN.DONE) {
          await ctx.reply("Menu", menuAdminKeyboard.reply());
          return ctx.scene.leave();
        }
        const path = env.PATH_SEEDING;
        let old = fs.existsSync(path) ? fs.readFileSync(path).toString() : "";
        fs.writeFileSync(
          path,
          `${old}
${ctx.message.text}`,
        );
      } catch (error: any) {
        ctx.reply(error.message, menuAdminKeyboard.reply());
      }
    },
  );
  return flow;
}

export function getGroupName() {
  const arr = env.GROUP_URL.split("/");
  return arr[arr.length - 1];
}
