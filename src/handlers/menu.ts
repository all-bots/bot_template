import { Context, Telegraf, Scenes, session } from "telegraf";
import rateLimit from "telegraf-ratelimit";
import env from "../utils/env";
import { flowSignUp } from "./scenes/signUp";
import { flowWithdraw } from "./scenes/withdraw";
import {
  CodeStatus,
  KycStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";
import { menuKeyboard, startKeyboard } from "./keyboard";
import {
  FLOW_WITHDRAW,
  BTN,
  FLOW_SIGN_UP,
  FLOW_MINE_TOKEN,
  FLOW_BUY,
} from "../utils/consts";
import { prisma } from "../utils/db";
import {
  getCurrentDate,
  getNextDay,
  getTimeLeft,
  makeRefLink,
  numberWithCommas,
  saveMessage,
} from "../utils";
import { getMiningRate } from "../helpers/mining";
import { flowMineToken } from "./scenes/mineToken";
import { sendMessage, sendNotifyAdmin } from "../utils/bot";
import { flowBuy } from "./scenes/buy";
import { ethers } from "ethers";

export const referralMap = new Map();

// Set limit to 1 message per 3 seconds
const limitConfig = {
  window: 3000,
  limit: 1,
  onLimitExceeded: (ctx: any) => {
    // ctx.reply("Too fast")
  },
};

const printStatsMenu = async (ctx: any) => {
  if (ctx.chat.id == env.GROUP_ID) return;
  try {
    // if (ctx.chat.id === env.GROUP_ID) return;
    if (ctx.user) {
      const msg = await ctx.reply(
        "You have been registered",
        menuKeyboard.reply(),
      );
      await saveMessage(prisma, msg);
      return;
    }
    sentUsers.set(ctx.from.id.toString(), false);
    ctx.scene.enter(FLOW_SIGN_UP);
  } catch (error) {
    console.log("🚀 ~ file: menu.ts:40 ~ printStatsMenu ~ error:", error);
  }
};

const start = async (ctx: any) => {
  if (ctx.chat.id == env.GROUP_ID) return;
  if (ctx.user) {
    const msg = await ctx.reply(
      "You have been registered.",
      menuKeyboard.reply(),
    );

    await saveMessage(prisma, msg);
    return;
  }
  if (ctx.startPayload) {
    let sponsor = await prisma.user.findFirst({
      where: {
        chatId: ctx.startPayload,
      },
    });
    if (sponsor?.firstName) {
      const msg = await ctx.reply(
        `ℹ️ You were invited by user ${sponsor.firstName}.`,
      );

      await saveMessage(prisma, msg);
      referralMap.set(ctx.chat.id, sponsor.id);
    }
  }

  let characters = [
    "[",
    "]",
    "(",
    ")",
    "~",
    "`",
    ">",
    "#",
    "+",
    "-",
    "=",
    "|",
    "{",
    "}",
    ".",
    "!",
    "_",
  ];
  let name = characters.reduce((str: string, character) => {
    return str.replaceAll(character, `\\${character}`);
  }, ctx.from.first_name);

  const msg = await ctx.replyWithMarkdownV2(
    `
🌈 Hi ${name}, this is X mining bot\\.

Through this bot, you can:
*\\- FREE mining ${env.MINE_RATE} X tokens per day*

Press "Join now" to start\\.
`,
    startKeyboard.reply(),
  );
  await saveMessage(prisma, msg);
};

export async function getBalance(userId: string) {
  try {
    const user = {
      id: userId,
    };
    let [balance, pendingWithdraw] = await Promise.all([
      prisma.walletChange.aggregate({
        where: {
          userId: user.id,
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.transaction.aggregate({
        where: {
          userId: user.id,
          type: TransactionType.WITHDRAW,
          status: {
            in: [TransactionStatus.PENDING, TransactionStatus.SUBMITTED],
          },
        },
        _sum: {
          amount: true,
        },
      }),
    ]);

    let total = balance?._sum?.amount || 0;
    let peding = pendingWithdraw?._sum?.amount || 0;
    return total - peding;
  } catch (error) {
    console.log("🚀 ~ file: menu.ts:99 ~ getBalance ~ error:", error);
    return 0;
  }
}

async function getWithdrawnToken(userId: string) {
  const data = await prisma.transaction.aggregate({
    where: {
      userId,
      type: TransactionType.WITHDRAW,
      status: TransactionStatus.APPROVED,
    },
    _sum: {
      amount: true,
    },
  });

  return data._sum.amount || 0;
}

async function showBalance(ctx: any) {
  try {
    if (ctx.chat.id == env.GROUP_ID) return;
    if (!ctx.user) return;
    let user = await prisma.user.findFirst({
      where: {
        chatId: ctx.from.id.toString(),
      },
      include: {
        Ref: {
          where: {
            status: KycStatus.APPROVED,
          },
        },
      },
    });
    let [balance, withdrawn, rate] = await Promise.all([
      getBalance(ctx.user.id),
      getWithdrawnToken(user.id),
      getMiningRate(prisma, ctx.from.id.toString()),
    ]);
    let characters = [
      "[",
      "]",
      "(",
      ")",
      "~",
      "`",
      ">",
      "#",
      "+",
      "-",
      "=",
      "|",
      "{",
      "}",
      ".",
      "!",
    ];
    let message = characters.reduce(
      (str: string, character) => {
        return str.replaceAll(character, `\\${character}`);
      },
      `
- Balance: ${numberWithCommas(balance)} X tokens

- Mining rate: ${numberWithCommas(rate)} X tokens per day
- Referral: ${user.Ref.length}
\\** Bonus: ${env.RATE_REFFERAL * env.MINE_RATE}X token/ Referral.*

- Withdrawn: ${numberWithCommas(withdrawn)} X tokens

- Token Contract: ${env.TOKEN_CONTRACT}
- Network: BNB Chain
`,
    );
    const msg = await ctx.replyWithMarkdownV2(message, menuKeyboard.reply());

    await saveMessage(prisma, msg);
  } catch (error) {}
}

async function handleWithdraw(ctx: any) {
  try {
    if (ctx.chat.id == env.GROUP_ID) return;
    if (!ctx.user) return;

    let balance = await getBalance(ctx.user.id);
    if (balance == 0) {
      const msg = await ctx.reply(
        "❌ Your balance is not enough to make a withdrawal.",
        menuKeyboard.reply(),
      );

      await saveMessage(prisma, msg);
      return;
    }
    let transaction = await prisma.transaction.findFirst({
      where: {
        userId: ctx.user.id,
        OR: [
          { status: TransactionStatus.SUBMITTED },
          { status: TransactionStatus.PENDING },
        ],
        type: TransactionType.WITHDRAW,
      },
    });
    if (transaction) {
      const msg = await ctx.reply(
        "Withdrawal is being processed.",
        menuKeyboard.reply(),
      );

      await saveMessage(prisma, msg);
      return;
    }
    ctx.scene.enter(FLOW_WITHDRAW);
  } catch (error) {}
}

async function handleMineToken(ctx: any) {
  try {
    if (ctx.chat.id == env.GROUP_ID) return;
    if (!ctx.user) return;

    let [code, transaction] = await Promise.all([
      prisma.code.findFirst({
        where: {
          date: getCurrentDate(),
          status: CodeStatus.VALID,
          userId: ctx.user.id,
        },
      }),
      prisma.transaction.findFirst({
        where: {
          userId: ctx.user.id,
          type: TransactionType.MINE_TOKEN,
          status: TransactionStatus.SUBMITTED,
        },
      }),
    ]);
    if (code) {
      const msg = await ctx.reply(
        "Today you have successfully mined, please come back tomorrow.",
        menuKeyboard.reply(),
      );

      await saveMessage(prisma, msg);
      return;
    }

    if (!transaction) {
      let now = new Date();
      await prisma.transaction.create({
        data: {
          userId: ctx.user.id,
          amount: env.MINE_RATE,
          type: TransactionType.MINE_TOKEN,
          expiration_date: getNextDay(),
          address: ctx.user.firstName || ctx.user.chatId,
          timeCreate: `${now.getUTCHours()}:${now.getUTCMinutes()}`,
        },
      });
      const msg = await ctx.reply(
        "Please come back tomorrow.",
        menuKeyboard.reply(),
      );

      await saveMessage(prisma, msg);
      return;
    }
    let now = new Date().getTime();
    let expirationDate = new Date(transaction.expiration_date).getTime();
    if (expirationDate - now < 60000) {
      sentUsers.set(ctx.user.chatId, false);
      ctx.scene.enter(FLOW_MINE_TOKEN);
    } else {
      const msg = await ctx.reply(
        `Please come back after ${getTimeLeft(
          transaction.expiration_date.toISOString(),
        )}`,
        menuKeyboard.reply(),
      );

      await saveMessage(prisma, msg);
      return;
    }
  } catch (error) {}
}

async function showReferral(ctx: any) {
  if (ctx.chat.id == env.GROUP_ID) return;
  try {
    const user = ctx.user;
    if (!user) return;
    const msg = await ctx.replyWithMarkdown(
      `
- Bonus: ${env.RATE_REFFERAL * env.MINE_RATE}X token/ Referral.
- Your referral link: ${makeRefLink(ctx.user?.chatId)}
    `,
      menuKeyboard.reply(),
    );

    await saveMessage(prisma, msg);
  } catch (error) {}
}

const handleSupport = async (ctx: any) => {
  try {
    if (!ctx.user) return;
    const msg = await ctx.reply(
      "Please contact @lindarose2899 for support!",
      menuKeyboard.reply(),
    );

    await saveMessage(prisma, msg);
  } catch (error) {
    console.log("🚀 ~ file: menu.ts:313 ~ start ~ error:", error);
  }
};

export const sentUsers = new Map<string, boolean>();
export default async function registerMenu(bot: Telegraf) {
  // let bot = new Telegraf(env.BOT_TOKEN);
  //rate limit
  bot.use(rateLimit(limitConfig));

  bot.catch((err: any, ctx: Context) => {
    console.log(`Ooops, encountered an error for ${ctx.updateType}`, err);
  });
  // await registerHandlers(bot)
  const stage = new Scenes.Stage([
    flowSignUp(),
    flowWithdraw(),
    flowMineToken(),
    flowBuy(),
  ]);
  bot.use(session());
  bot.use(stage.middleware());

  bot.start(start);
  bot.help(start);

  bot.hears(BTN.START, printStatsMenu);

  bot.hears(BTN.BALANCE, showBalance);
  bot.hears(BTN.WITHDRAW, handleWithdraw);
  bot.hears(BTN.REFERRAL, showReferral);
  bot.hears(BTN.MINE_TOKEN, handleMineToken);
  bot.hears(BTN.SUPPORT, handleSupport);
  bot.hears(BTN.BUY, handleBuy);
  bot.hears("Send Mine", async (ctx: any) => {
    try {
      let users = await prisma.user.findMany({
        where: {
          firstName: {
            in: ["Jil", "Name", "Ellie"],
          },
        },
      });
      await Promise.all(
        users.map(async (user) => {
          await sendMessage(
            env.BOT_TOKEN,
            user.chatId.toString(),
            `Click "${BTN.MINE_TOKEN}" to mine X token`,
            BTN.MINE_TOKEN,
          );
          await new Promise((resolve) => setTimeout(resolve, 100));
        }),
      );
    } catch (error) {}
  });
  bot.hears(BTN.LIST_BUY_IDO_TODAY, handleListIdo);
  bot.on("text", (ctx) => {
    const chatId = ctx.from.id.toString();
    if (
      sentUsers.has(chatId) &&
      !sentUsers.get(chatId) &&
      ctx.update.message.chat.id == Number(env.GROUP_ID)
    ) {
      sentUsers.set(chatId, true);
    }
  });
}

export async function getListIdo() {
  const now = new Date();
  const startDate = new Date();
  startDate.setUTCHours(10, 0, 0, 0);
  const endDate = new Date(startDate.getTime());
  if (now.getUTCHours() < 10) {
    startDate.setDate(startDate.getDate() - 1);
  } else {
    endDate.setDate(endDate.getDate() + 1);
  }
  const data = await prisma.$queryRaw<any[]>(Prisma.sql`
  SELECT address, MIN(created_at) AS time
  FROM ido_log
  WHERE created_at >= ${startDate}
    AND created_at < ${endDate}
  GROUP BY address
  ORDER BY time ASC;
`);
  if (data.length == 0) return "";
  const list = data.reduce((res, item, index) => {
    if (res.length == 0)
      return `${index + 1}. ${ethers.getAddress(item.address)}`;
    return `${res}
${index + 1}. ${ethers.getAddress(item.address)}`;
  }, "");
  const formattedDate = startDate.toLocaleDateString("en-US", {
    month: "long", // Full month name
    day: "numeric", // Day of the month
  });
  return `IDO purchase list for today (${formattedDate}): 
${list}`;
}
async function handleListIdo(ctx: any) {
  try {
    if (ctx.chat.id === env.GROUP_ID) return;
    if (!ctx.user) return;
    const list = await getListIdo();

    const msg = await ctx.reply(
      list.length == 0 ? `No users` : list,
      menuKeyboard.reply(),
    );

    await saveMessage(prisma, msg);
  } catch (error) {
    const time = new Date().toISOString();
    console.log(time, error);
    await sendNotifyAdmin(`${time}: get list ido error`);
  }
}

// getBalance("1210753029").then(console.log);

async function handleBuy(ctx: any) {
  try {
    if (ctx.chat.id === env.GROUP_ID) return;
    if (!ctx.user) return;

    let transaction = await prisma.transaction.findFirst({
      where: {
        userId: ctx.user.id,
        type: TransactionType.BUY_PACKAGE,
        status: TransactionStatus.SUBMITTED,
      },
    });
    if (transaction) {
      const msg = await ctx.reply(
        "Please complete the pending transaction buy package!",
        menuKeyboard.reply(),
      );

      await saveMessage(prisma, msg);
      return;
    }
    ctx.scene.enter(FLOW_BUY);
  } catch (error) {}
}
