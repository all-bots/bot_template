import { Scenes } from "telegraf";
import { genCaptcha, genCaptchaSvg } from "../../helpers/captcha";
import { FLOW_MINE_TOKEN } from "../../utils/consts";
import { doneKeyboard, menuKeyboard, startKeyboard } from "../keyboard";
import {
  getCurrentDate,
  getNextDay,
  getRndInteger,
  numberWithCommas,
  publisher,
  saveMessage,
} from "../../utils";
import { prisma } from "../../utils/db";
import {
  CaptchaType,
  CodeStatus,
  Prisma,
  PrismaClient,
  TransactionStatus,
  TransactionType,
  User,
  WalletChangeType,
} from "@prisma/client";
// import { getMiningRate } from "../../helpers/mining";
import env from "../../utils/env";
import { sendMessage } from "../../utils/bot";
import { getMiningPackage } from "../../helpers/mining";
import { sentUsers } from "../menu";

async function getCodeSend() {
  const newCaptcha = await genCaptcha();
  return {
    code: newCaptcha.value,
    image: newCaptcha.imageValue,
  };
}

async function sendCode(
  ctx: any,
  message: string = "",
  // isCreate: boolean = false
) {
  const code = await getCodeSend();
  ctx.scene.state.captcha = code.code;
  ctx.scene.state.image = code.image;
  let msg = await ctx.reply(
    message || "🔐 Enter the captcha below to proceed",
    startKeyboard.remove(),
  );
  await saveMessage(prisma, msg);
  msg = await ctx.replyWithPhoto({ source: Buffer.from(code.image, "base64") });
  await saveMessage(prisma, { ...msg, text: "captcha mine token" });
}

export function flowMineToken() {
  const flow = new Scenes.WizardScene(
    FLOW_MINE_TOKEN,
    async (ctx: any) => {
      try {
        ctx.scene.state.num = 0;
        ctx.scene.state.timeStart = new Date().toISOString();
        await sendCode(ctx);
        return ctx.wizard.next();
      } catch (error) {
        console.log(error);
      }
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
                  note: "Mine Token",
                  type: CaptchaType.CAPTCHA,
                  lockId: lockId,
                },
              }),
            ]);
            await prisma.messageBot.create({
              data: {
                chatId: arr[0].chat.id.toString(),
                messageId: arr[0].message_id,
                content: arr[0].text,
              },
            });
            return;
          }
          const newCaptcha = await genCaptcha();
          ctx.scene.state.captcha = newCaptcha.value;
          let msg = await ctx.reply(`❌ Invalid code. Please try again!`);

          await saveMessage(prisma, msg);
          msg = await ctx.replyWithPhoto(newCaptcha.image);
          await saveMessage(prisma, { ...msg, text: "captcha mine token" });
          return;
        }

        ctx.scene.state.countInvalid = 0;
        const newCaptcha = await genCaptchaSvg();
        ctx.scene.state.captcha = newCaptcha.value;
        let msg = await ctx.reply(`Enter the result of this calculation: `);

        await saveMessage(prisma, msg);
        msg = await ctx.replyWithPhoto(newCaptcha.image);

        await saveMessage(prisma, { ...msg, text: "captcha svg mine token" });
        return ctx.wizard.next();
      } catch (error) {}
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
                  note: "Mine Token",
                  type: CaptchaType.CAPTCHA_SVG,
                  lockId: lockId,
                },
              }),
            ]);
            await saveMessage(prisma, arr);
            return;
          }
          const newCaptcha = await genCaptchaSvg();
          ctx.scene.state.captcha = newCaptcha.value;
          let msg = await ctx.reply(`❌ Invalid. Please try again!
Enter the result of this calculation:`);
          await saveMessage(prisma, msg);

          msg = await ctx.replyWithPhoto(newCaptcha.image);

          await saveMessage(prisma, { ...msg, text: "captcha svg mine token" });
          return;
        }
        let random = getRndInteger(3, 5);
        random = 1;
        let user = await prisma.user.findFirst({
          where: {
            chatId: ctx.from.id.toString(),
          },
          include: {
            Sponsor: true,
          },
        });
        if (!user) {
          let msg = await ctx.reply(`User not exists`, menuKeyboard.reply());
          await saveMessage(prisma, msg);
          return ctx.scene.leave();
        }

        let num = ctx.scene.state.num || 1;
        if (num < random) {
          await sendCode(ctx, "🔐 Try enter the captcha below to proceed");
          ctx.scene.state.num = num + 1;
          return;
        }

        // let data = user.Code.filter((item) => item.code == ctx.message.text);
        if (ctx.scene.state.captcha != ctx.message?.text) {
          await sendCode(ctx, "🔐 Try enter the captcha below to proceed");
          return;
        }

        const msg = await ctx.replyWithMarkdown(
          `The final step: Please leave a comment in the [group](${env.GROUP_URL}) to mine X Token!`,
          doneKeyboard.reply(),
        );
        await saveMessage(prisma, msg);

        return ctx.wizard.next();
      } catch (error) {
        console.log("🚀 ~ file: MineToken.ts:101 ~ // ~ error:", error);
      }
    },
    async (ctx: any) => {
      try {
        const user = ctx.user;
        if (!sentUsers.get(user.chatId)) {
          const msg = await ctx.replyWithMarkdown(
            `🆘 You can’t mine X Token if you don’t leave a comment in the [group](${env.GROUP_URL}).`,
          );
          await saveMessage(prisma, msg);
          return;
        }
        let amount = await getMiningPackage(prisma, user);

        let transaction = await prisma.transaction.findFirst({
          where: {
            userId: user.id,
            status: TransactionStatus.SUBMITTED,
            type: TransactionType.MINE_TOKEN,
          },
        });
        const packages = await getPackage(prisma, user);
        const updateWallet = packages.map((item) => ({
          amount: item.amount,
          type: WalletChangeType.PACKAGE,
          userId: user.id,
          eventId: item.eventId,
        }));
        let now = new Date();
        await Promise.all([
          // update balance
          prisma.walletChange.createMany({
            data: [
              {
                amount: env.MINE_RATE,
                type: WalletChangeType.MINE_TOKEN,
                userId: user.id,
                eventId: transaction.id,
              },
              ...updateWallet,
            ],
          }),
          // update status code
          prisma.code.create({
            data: {
              status: CodeStatus.VALID,
              userId: user.id,
              code: ctx.message.text,
              image: ctx.scene.state.image,
              date: getCurrentDate(),
            },
          }),

          // update time mine token
          prisma.user.update({
            where: {
              id: user.id,
            },
            data: {
              timeCreate: `${now.getUTCHours()}:${now.getUTCMinutes()}`,
            },
          }),
          prisma.transaction.create({
            data: {
              userId: ctx.user.id,
              amount: env.MINE_RATE,
              type: TransactionType.MINE_TOKEN,
              expiration_date: getNextDay(),
              address: ctx.user.firstName || ctx.user.chatId,
              timeCreate: `${now.getUTCHours()}:${now.getUTCMinutes()}`,
            },
          }),

          // create log
          // prisma.logMine.create({
          //   data: {
          //     time_start: ctx.scene.state.timeStart,
          //     time_end: new Date().toISOString(),
          //     userId: ctx.user.id,
          //   },
          // }),
        ]);
        amount += env.MINE_RATE;
        let data = [
          {
            amount,
            chatId: user.chatId,
          },
        ];
        if (transaction) {
          // update status old transaction
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: TransactionStatus.APPROVED },
          });
        }
        now.setMonth(now.getMonth() + 3);
        const formattedDate = now.toLocaleDateString("en-US", {
          month: "long", // Full month name
          day: "numeric", // Day of the month
        });
        if (user.Sponsor) {
          let amountSponsor = amount * env.RATE_REFFERAL;
          await Promise.all([
            prisma.walletChange.create({
              data: {
                userId: user.sponsorId,
                amount: amountSponsor,
                type: WalletChangeType.REFFERAL_MINE_TOKEN,
                note: user.id,
              },
            }),
          ]);
          await sendMessage(
            env.BOT_TOKEN,
            user.Sponsor.chatId,
            `You have received ${numberWithCommas(
              amount,
            )} X tokens successfully mined by user "${user.firstName} ${
              user.lastName || ""
            }". This token will start to be unlocked on ${formattedDate}. Click “Withdraw” to withdraw X Token to your wallet for free.`,
          );
          data.push({
            amount: amountSponsor,
            chatId: user.Sponsor.chatId,
          });
        }

        const msg = await ctx.reply(
          `You just mined ${numberWithCommas(
            amount,
          )} X tokens. This token will start to be unlocked on ${formattedDate}. Click “Withdraw” to withdraw X Token to your wallet for free.`,
          menuKeyboard.reply(),
        );
        await saveMessage(prisma, msg);
        sentUsers.delete(user.chatId);
        await publisher.publish("update-balance", JSON.stringify(data));

        return ctx.scene.leave();
      } catch (error) {
        console.log("🚀 ~ file: MineToken.ts:101 ~ // ~ error:", error);
      }
    },
  );
  return flow;
}

async function getPackage(prisma: PrismaClient, user: User) {
  try {
    let transactions = await prisma.$queryRaw<
      { event_id: string; amount: number; amount_sent: number }[]
    >(Prisma.sql`
  WITH sent AS (
    SELECT
      event_id,
      sum(amount) AS amount_sent
    FROM
      wallet_change
    WHERE
      user_id::text = ${user.id}
      AND type = 'PACKAGE'
    GROUP BY
      event_id
  )
  SELECT
  "transaction".id as event_id,
    amount,
    COALESCE(amount_sent, 0) as amount_sent
  FROM
    "transaction"
    LEFT JOIN sent ON "transaction".id::text = sent.event_id::text
  WHERE status = 'APPROVED'
    AND type = 'BUY_PACKAGE'
    AND  sent.amount_sent < (${env.PROFIT_BONUS_PACKAGE} * transaction.amount)
    AND user_id::text= ${user.id}
  `);
    return transactions.reduce((total, transaction) => {
      let max = transaction.amount * env.PROFIT_BONUS_PACKAGE;
      if (transaction.amount_sent < max) {
        let amount =
          transaction.amount + transaction.amount_sent <= max
            ? transaction.amount
            : max - transaction.amount_sent;

        total.push({
          eventId: transaction.event_id,
          amount,
        });
      }
      return total;
    }, []);
  } catch (error) {
    console.log("🚀 ~ file: mineToken.ts:263 ~ getPackage ~ error:", error);
    return [];
  }
}
