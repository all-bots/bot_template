import { Scenes } from "telegraf";
import { referralMap, sentUsers } from "../menu";
// import { genCaptcha } from "../../helpers/captcha";
import { FLOW_SIGN_UP } from "../../utils/consts";
import { doneKeyboard, menuKeyboard, startKeyboard } from "../keyboard";
import {
  getNextDay,
  makeRefLink,
  numberWithCommas,
  publisher,
  saveMessage,
} from "../../utils";
import { prisma } from "../../utils/db";
import {
  CaptchaType,
  KycStatus,
  TransactionType,
  WalletChangeType,
} from "@prisma/client";
import env from "../../utils/env";
import { sendMessage } from "../../utils/bot";
// import { sendGenerateWalletMessage } from "../../utils/redis";
import { genCaptchaSvg, genCaptcha } from "../../helpers/captcha";

export function flowSignUp() {
  const flow = new Scenes.WizardScene(
    FLOW_SIGN_UP,
    async (ctx: any) => {
      try {
        const newCaptcha = await genCaptcha();
        ctx.scene.state.captcha = newCaptcha.value;
        let msg = await ctx.reply(
          "🔐 Enter the captcha below to proceed",
          startKeyboard.remove(),
        );
        await saveMessage(prisma, msg);
        msg = await ctx.replyWithPhoto(newCaptcha.image);
        await saveMessage(prisma, { ...msg, text: "captcha sign up" });
        return ctx.wizard.next();
      } catch (error) {
        console.log(error);
      }
    },
    async (ctx: any) => {
      try {
        let countInvalid = ctx.scene.state.countInvalid || 0;
        if (ctx.scene.state.lockId) {
          const lock = await prisma.lockCaptcha.findFirst({
            where: {
              chatId: ctx.from.id.toString(),
              lockId: ctx.scene.state.lockId,
            },
          });
          if (!lock?.code) {
            return;
          } else {
            ctx.scene.state.captcha = lock.code;
            ctx.scene.state.lockId = null;
          }
        }
        if (ctx.message.text !== ctx.scene.state.captcha) {
          countInvalid++;
          ctx.scene.state.countInvalid = countInvalid;
          if (countInvalid >= 5) {
            const now = new Date();
            const lockId = now.toISOString();
            ctx.scene.state.lockId = lockId;
            ctx.scene.state.countInvalid = 0;
            const time = new Date(now.getTime() + env.TIME_LOCK);
            const arr = await Promise.all([
              ctx.reply(
                "You have entered incorrectly many times. Please try again after 1 hour!",
              ),
              prisma.lockCaptcha.create({
                data: {
                  chatId: ctx.from.id.toString(),
                  time: `${time.getUTCHours()}:${time.getUTCMinutes()}`,
                  note: "SIGN_UP",
                  type: CaptchaType.CAPTCHA,
                  lockId: lockId,
                },
              }),
            ]);

            await saveMessage(prisma, arr[0]);
            return;
          }
          const newCaptcha = await genCaptcha();
          ctx.scene.state.captcha = newCaptcha.value;
          let msg = await ctx.reply(`❌ Invalid code. Please try again!`);

          await saveMessage(prisma, msg);

          msg = await ctx.replyWithPhoto(newCaptcha.image);
          await saveMessage(prisma, { ...msg, text: "captcha sign up" });
          return;
        }

        ctx.scene.state.countInvalid = 0;
        const newCaptcha = await genCaptchaSvg();
        ctx.scene.state.captcha = newCaptcha.value;
        let msg = await ctx.reply(`Enter the result of this calculation: `);
        await saveMessage(prisma, msg);
        msg = await ctx.replyWithPhoto(newCaptcha.image);

        await saveMessage(prisma, { ...msg, text: "captcha svg sign up" });
        return ctx.wizard.next();
      } catch (error) {}
    },
    async (ctx: any) => {
      try {
        // console.log(ctx.message.text, ctx.scene.state.captcha);
        let countInvalid = ctx.scene.state.countInvalid || 0;
        if (ctx.scene.state.lockId) {
          const lock = await prisma.lockCaptcha.findFirst({
            where: {
              chatId: ctx.from.id.toString(),
              lockId: ctx.scene.state.lockId,
            },
          });
          if (!lock?.code) {
            return;
          } else {
            ctx.scene.state.captcha = lock.code;
            ctx.scene.state.lockId = null;
          }
        }
        if (ctx.message.text !== ctx.scene.state.captcha) {
          countInvalid++;
          ctx.scene.state.countInvalid = countInvalid;
          if (countInvalid >= 5) {
            const now = new Date();
            const lockId = now.toISOString();
            ctx.scene.state.lockId = lockId;
            ctx.scene.state.countInvalid = 0;
            const time = new Date(now.getTime() + env.TIME_LOCK);
            const arr = await Promise.all([
              ctx.reply(
                "You have entered incorrectly many times. Please try again after 1 hour!",
              ),
              prisma.lockCaptcha.create({
                data: {
                  chatId: ctx.from.id.toString(),
                  time: `${time.getUTCHours()}:${time.getUTCMinutes()}`,
                  note: "SIGN_UP",
                  type: CaptchaType.CAPTCHA_SVG,
                  lockId: lockId,
                },
              }),
            ]);

            await saveMessage(prisma, arr[0]);
            return;
          }
          const newCaptcha = await genCaptchaSvg();
          ctx.scene.state.captcha = newCaptcha.value;
          let msg = await ctx.reply(`❌ Invalid. Please try again!
Enter the result of this calculation:`);

          await saveMessage(prisma, msg);
          msg = await ctx.replyWithPhoto(newCaptcha.image);

          await saveMessage(prisma, { ...msg, text: "captcha svg sign up" });
          return;
        }
        const msg = await ctx.replyWithMarkdown(
          `🎉 That's correct! Congratulations!

📜 Complete all required tasks below:

1️⃣ Follow [Telegram channel](${env.CHANNEL_URL}).

2️⃣ Join [Telegram group](${env.GROUP_URL}) then invite at least 3 friends to join our group and leave one comment.
`,
          doneKeyboard.reply(),
        );

        await saveMessage(prisma, msg);
        return ctx.wizard.next();
      } catch (error) {}
    },
    async (ctx) => {
      try {
        const rs = await Promise.all([
          ctx.tg.getChatMember(env.GROUP_ID, ctx.from.id),
          ctx.tg.getChatMember(env.CHANNEL_ID, ctx.from.id),
        ]);
        const chatId: string = ctx.from.id.toString();
        if (
          rs[0] &&
          rs[0].status !== "left" &&
          rs[1] &&
          rs[1].status !== "left" &&
          sentUsers.get(chatId)
        ) {
          let now = new Date();
          let user = await prisma.user.create({
            data: {
              chatId: chatId,
              firstName: ctx.from.first_name as string,
              lastName: ctx.from.last_name as string,
              sponsorId: referralMap.get(ctx.from.id) ?? null,
              username: ctx.from.username as string,
              status: KycStatus.APPROVED,
              timeCreate: `${now.getUTCHours()}:${now.getUTCMinutes()}`,
            },
          });
          let data = [
            {
              amount: env.MINE_RATE,
              chatId: user.chatId,
            },
          ];
          if (referralMap.get(ctx.from.id)) {
            let sponsor = await prisma.user.findFirst({
              where: {
                id: referralMap.get(ctx.from.id),
              },
            });
            if (sponsor) {
              let amount = env.MINE_RATE * env.RATE_REFFERAL;
              data.push({
                amount,
                chatId: sponsor.chatId,
              });
              await Promise.all([
                prisma.walletChange.create({
                  data: {
                    userId: sponsor.id,
                    amount,
                    type: WalletChangeType.REFFERAL_MINE_TOKEN,
                    note: user.id,
                  },
                }),
                sendMessage(
                  env.BOT_TOKEN,
                  sponsor.chatId,
                  `You have received ${numberWithCommas(
                    amount,
                  )} X tokens successfully mined by user "${user.firstName} ${
                    user.lastName || ""
                  }"`,
                ),
              ]);
              sentUsers.delete(chatId);
            }
          }
          await Promise.all([
            prisma.walletChange.create({
              data: {
                userId: user.id,
                amount: env.MINE_RATE,
                type: WalletChangeType.MINE_TOKEN,
              },
            }),
            prisma.transaction.create({
              data: {
                userId: user.id,
                amount: env.MINE_RATE,
                type: TransactionType.MINE_TOKEN,
                expiration_date: getNextDay(),
                address: user.firstName || user.chatId,
                timeCreate: `${now.getUTCHours()}:${now.getUTCMinutes()}`,
              },
            }),
          ]);

          referralMap.delete(ctx.from.id);
          const msg = await ctx.replyWithMarkdown(
            `
Congratulations!
You have mined ${env.MINE_RATE} X tokens.

Token Contract: ${env.TOKEN_CONTRACT}
Network: BNB Chain

Mining Rate: ${env.MINE_RATE} X tokens per day.

*Bonus: ${env.RATE_REFFERAL * env.MINE_RATE}X token/ Valid Referral.*

Your referral link: ${makeRefLink(chatId)}
`,
            menuKeyboard.reply(),
          );
          await saveMessage(prisma, msg);
          // await sendGenerateWalletMessage(user.id);
          await publisher.publish("update-balance", JSON.stringify(data));
          return ctx.scene.leave();
        } else {
          if (!sentUsers.get(chatId)) {
            const msg = await ctx.replyWithMarkdown(
              `
🆘 You can’t move to the next step if you don’t leave a comment in the [group](${env.GROUP_URL}) and invite 3 friends to the [group](${env.GROUP_URL}).
        `,
              doneKeyboard.reply(),
            );
            await saveMessage(prisma, msg);
          } else {
            const msg = await ctx.replyWithMarkdown(
              `
🆘 You can't move to next step if not join the [Telegram group](${env.GROUP_URL}), [Telegram channel](${env.CHANNEL_URL}) and invite 3 friends to group
        `,
              doneKeyboard.reply(),
            );
            await saveMessage(prisma, msg);
          }
        }
      } catch (error) {
        console.log("🚀 ~ file: signUp.ts:101 ~ // ~ error:", error);
      }
    },
  );
  return flow;
}
