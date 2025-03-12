import { Context, Telegraf, Scenes, session } from "telegraf";
import rateLimit from "telegraf-ratelimit";
import env from "../utils/env";

const MESSAGE = `
💰 Mining *750 X tokens* for *FREE* every day.

🎁 *FREE* instant withdrawal to your wallet.

🔥 Mining rate per day will increase to *150 X tokens/referral*.

Start now  👉 https://t.me/X\\_mining\\_bot 👈`;

import {
  ConfigType,
  TransactionStatus,
  TransactionType,
  WalletChangeType,
} from "@prisma/client";
import { menuAdminKeyboard } from "./keyboard";
import {
  BTN,
  FLOW_CHECK_ADDRESS,
  FLOW_CHECK_USER,
  FLOW_CONFIG_SEEDING,
  FLOW_CONFIG_SWAP,
  FLOW_SET_TIME,
  FLOW_UPDATE_SEEDING,
} from "../utils/consts";
import { prisma } from "../utils/db";
import { numberWithCommas } from "../utils";
import { Result } from "../jobs/mineToken";
import { ethers } from "ethers";
import { getProvider } from "../helpers/providers";
import { getErc20Contract, provider } from "../helpers/contract-accessor";
import { sendMessage, sendNotifyAdmin } from "../utils/bot";
import { flowSetTime } from "./scenes/setTime";
import { flowCheckUser } from "./scenes/checkUser";
import { flowCheckAddress } from "./scenes/checkAddress";
import fs from "fs";
import { flowConfigSwap } from "./scenes/flowConfigSwap";
import { flowConfigSeeding } from "./scenes/configSeeding";
import { flowUpdateSeeding, getGroupName } from "./scenes/updateSeeding";
import { redis } from "../utils/redis";
import { getGasPrice } from "../utils/eth-service";

export const referralMap = new Map();

// Set limit to 1 message per 3 seconds
const limitConfig = {
  window: 3000,
  limit: 1,
  onLimitExceeded: (ctx: any) => {
    // ctx.reply("Too fast")
  },
};

const printStatsMenu = (ctx: any) => {
  if (ctx.chat.id == env.GROUP_ID) return;
  if (env.ADMIN_ID.split(",").includes(ctx.from.id.toString())) {
    return ctx.reply("You have been registered", menuAdminKeyboard.reply());
  }
  ctx.replyWithMarkdown(MESSAGE);
};

const start = async (ctx: any) => {
  if (ctx.chat.id == env.GROUP_ID) return;
  if (env.ADMIN_ID.split(",").includes(ctx.from.id.toString())) {
    return ctx.reply("You have been registered", menuAdminKeyboard.reply());
  }
  await ctx.replyWithMarkdown(MESSAGE);
};

async function handleSendWithdraw(ctx: any) {
  if (ctx.chat.id == env.GROUP_ID) return;
  if (!env.ADMIN_ID.split(",").includes(ctx.from.id.toString())) return;
  let timeId = new Date().getTime();
  console.time(`job_${timeId}`);

  let transactionsUpdate: Result[] = [];
  let arr: any[] = [];
  await ctx.reply("Đang xử lý", menuAdminKeyboard.remove());
  let hash = "";
  try {
    let transactions = await prisma.transaction.findMany({
      where: {
        type: TransactionType.WITHDRAW,
        status: TransactionStatus.SUBMITTED,
        isSkip: false,
        amount: { gt: 0 },
      },
      include: {
        User: true,
      },
      // take: env.MAX_SEND,
    });
    let data: any = {};
    for (let transaction of transactions) {
      if (Object.values(data).length == env.MAX_SEND) break;
      let key = transaction.address;
      if (data.hasOwnProperty(key)) {
        data[key] = {
          ...data[key],
          amount: data[key].amount + transaction.amount,
          data: [
            ...data[key].data,
            {
              id: transaction.id,
              amounts: transaction.amount,
            },
          ],
        };
      } else {
        data[key] = {
          address: transaction.address,
          amount: transaction.amount,
          data: [
            {
              id: transaction.id,
              amounts: transaction.amount,
            },
          ],
        };
      }
      transactionsUpdate.push(transaction);
    }
    arr = Object.values(data);
    console.log("🚀 ~ file: mineToken.ts:60 ~ main ~ arr.length:", arr.length);
    // fs.writeFileSync("data.json", JSON.stringify(arr, null, 2));
    // if (arr.length != env.MAX_SEND) return;
    let ids = transactionsUpdate.map((transaction) => transaction.id);
    let reciepts = arr.map((transaction) => transaction.address);
    let amounts = arr.map((transaction) =>
      ethers.parseEther(transaction.amount.toString()),
    );
    await prisma.transaction.updateMany({
      where: {
        id: {
          in: ids,
        },
      },
      data: {
        status: TransactionStatus.PENDING,
      },
    });

    let wallet = new ethers.Wallet(
      env.MASTER_WALLET_PRIVATE_KEY,
      getProvider(),
    );

    const price = await getGasPrice();
    let contract = getErc20Contract(env.TOKEN_CONTRACT, wallet);

    let tx = await contract.mintToken(reciepts, amounts, {
      gasPrice: (price * 10n) / 10n,
    });

    console.log("tx hash: ", tx.hash);
    let transaction = await tx.wait();
    hash = transaction.hash;
    if (transaction.hash) {
      await prisma.transaction.updateMany({
        where: {
          id: {
            in: ids,
          },
        },
        data: {
          hash: transaction.hash,
          status: TransactionStatus.APPROVED,
        },
      });
      for (let transaction of transactionsUpdate) {
        await Promise.all([
          sendMessage(
            env.BOT_TOKEN,
            transaction.User.chatId,
            "✅ Withdrawal successful! Please check your wallet.",
          ),
          prisma.walletChange.create({
            data: {
              userId: transaction.User.id,
              amount: -transaction.amount,
              type: WalletChangeType.WITHDRAW,
            },
          }),
        ]);
      }
    }
  } catch (error) {
    await ctx.reply(error.message);

    if (transactionsUpdate.length > 0) {
      let ids = transactionsUpdate.map((transaction) => transaction.id);
      if (hash) {
        await prisma.transaction.updateMany({
          where: {
            id: {
              in: ids,
            },
          },
          data: {
            status: TransactionStatus.APPROVED,
          },
        });
      } else {
        await prisma.transaction.updateMany({
          where: {
            id: {
              in: ids,
            },
          },
          data: {
            status: TransactionStatus.SUBMITTED,
          },
        });
      }
    }
  }
  console.timeEnd(`job_${timeId}`);
}

async function handleCheckWithdraw(ctx: any) {
  if (ctx.chat.id == env.GROUP_ID) return;
  if (!env.ADMIN_ID.split(",").includes(ctx.from.id.toString())) return;
  try {
    let transactions = await prisma.transaction.findMany({
      where: {
        type: TransactionType.WITHDRAW,
        status: TransactionStatus.SUBMITTED,
      },
    });
    let data = transactions.reduce(
      (rs, item) => {
        if (!rs.arr.includes(item.address)) {
          rs.arr.push(item.address);
        }
        rs.amount += item.amount;
        return rs;
      },
      {
        amount: 0,
        arr: [],
      },
    );
    await ctx.reply(`Số lượng request rút: ${data.arr.length}
Tổng số token request rút: ${numberWithCommas(data.amount)}`);
  } catch (error) {}
}

export default async function registerMenuAdmin(bot: Telegraf) {
  bot.use(rateLimit(limitConfig));

  bot.catch((err: any, ctx: Context) => {
    console.log(`Ooops, encountered an error for ${ctx.updateType}`, err);
  });
  // await registerHandlers(bot)
  const stage = new Scenes.Stage([
    flowSetTime(),
    flowCheckUser(),
    flowCheckAddress(),
    flowConfigSwap(),
    flowConfigSeeding(),
    flowUpdateSeeding(),
  ]);
  bot.use(session());
  bot.use(stage.middleware());

  bot.start(start);
  bot.help(start);

  bot.hears(BTN.START, printStatsMenu);

  bot.hears(BTN.CHECK_WITHDRAW, handleCheckWithdraw);
  bot.hears(BTN.SEND_WITHDRAW, handleSendWithdraw);
  bot.hears(BTN.ENABLE_WITHDRAW, handleEnableWithdraw);
  bot.hears(BTN.DISABLE_WITHDRAW, handleDisableWithdraw);
  bot.hears(BTN.SET_TIME_FORWARD, handleSetTime);
  bot.hears(BTN.CHECK_USER, handleCheckUser);
  bot.hears(BTN.CHECK_ADDRESS, handleCheckAddress);
  bot.hears(BTN.CHECK_ALL, handleCheckAll);
  bot.hears(BTN.LOCK, handleLockAll);
  bot.hears(BTN.UNLOCK, handleUnlockAll);
  bot.hears(BTN.CONFIG_SWAP, handleConfigAutoSwap);
  bot.hears(BTN.CONFIG_TIME_SEEDING, handleConfigSeeding);
  bot.hears(BTN.UPDATE_CONTENT_SEEDING, handleUpdateSeeding);
  bot.hears(BTN.ON_SEEDING, handleOnSeeding);
  bot.hears(BTN.OFF_SEEDING, handleOffSeeding);
}

async function handleOnSeeding(ctx: any) {
  if (ctx.chat.id == env.GROUP_ID) return;
  if (!env.ADMIN_ID.split(",").includes(ctx.from.id.toString())) return;
  try {
    const group = getGroupName();
    await redis.set("CONFIG_SEEDING_" + group, 1);
    await ctx.reply("Đã bật seeding vào group " + group);
  } catch (error) {}
}

async function handleOffSeeding(ctx: any) {
  if (ctx.chat.id == env.GROUP_ID) return;
  if (!env.ADMIN_ID.split(",").includes(ctx.from.id.toString())) return;
  try {
    const group = getGroupName();
    await redis.del("CONFIG_SEEDING_" + group);
    await ctx.reply("Đã tắt seeding vào group " + group);
  } catch (error) {}
}

async function handleConfigSeeding(ctx: any) {
  if (ctx.chat.id == env.GROUP_ID) return;
  if (!env.ADMIN_ID.split(",").includes(ctx.from.id.toString())) return;
  try {
    ctx.scene.enter(FLOW_CONFIG_SEEDING);
  } catch (error) {}
}

async function handleUpdateSeeding(ctx: any) {
  if (ctx.chat.id == env.GROUP_ID) return;
  if (!env.ADMIN_ID.split(",").includes(ctx.from.id.toString())) return;
  try {
    ctx.scene.enter(FLOW_UPDATE_SEEDING);
  } catch (error) {}
}

async function handleConfigAutoSwap(ctx: any) {
  if (ctx.chat.id == env.GROUP_ID) return;
  if (!env.ADMIN_ID.split(",").includes(ctx.from.id.toString())) return;
  try {
    ctx.scene.enter(FLOW_CONFIG_SWAP);
  } catch (error) {}
}

async function handleLockAll(ctx: any) {
  if (ctx.chat.id == env.GROUP_ID) return;
  if (!env.ADMIN_ID.split(",").includes(ctx.from.id.toString())) return;
  try {
    await ctx.reply("Đang xử lý");
    await configLock(true);
    await ctx.reply("Đã lock all token.");
  } catch (error) {
    console.log("🚀 ~ handleLockAll ~ error:", error);
    await sendNotifyAdmin("config lock fail");
  }
}

async function handleUnlockAll(ctx: any) {
  if (ctx.chat.id == env.GROUP_ID) return;
  if (!env.ADMIN_ID.split(",").includes(ctx.from.id.toString())) return;
  try {
    await ctx.reply("Đang xử lý");
    await configLock(false);
    await ctx.reply("Đã tắt lock all token. Unlock token như logic thường");
  } catch (error) {
    console.log("🚀 ~ handleUnlockAll ~ error:", error);
    await sendNotifyAdmin("config lock fail");
  }
}

async function handleCheckAll(ctx: any) {
  if (ctx.chat.id == env.GROUP_ID) return;
  if (!env.ADMIN_ID.split(",").includes(ctx.from.id.toString())) return;
  try {
    const file = "data.txt";
    await ctx.reply("Đợi xử lý");
    if (fs.existsSync(file)) {
      fs.rmSync(file, {
        force: true,
      });
    }
    const users = await prisma.user.findMany({
      select: {
        username: true,
        firstName: true,
        lastName: true,
        chatId: true,
      },
    });
    let msg = users.reduce((msg, user, index) => {
      let username = user?.username || "";
      return `${msg}
${index + 1}. User: ${user?.firstName || ""} ${user?.lastName || ""}${
        username ? ": @" + username : ""
      }
    chatId: ${user.chatId}`;
    }, "");

    fs.writeFileSync(file, msg);
    await ctx.telegram.sendDocument(ctx.from.id, {
      source: file,
    });
    await ctx.reply("Menu", menuAdminKeyboard.reply());
  } catch (error) {
    console.log("🚀 ~ file: menuAdmin.ts:307 ~ handleCheckAll ~ error:", error);
  }
}

async function handleEnableWithdraw(ctx: any) {
  if (ctx.chat.id == env.GROUP_ID) return;
  if (!env.ADMIN_ID.split(",").includes(ctx.from.id.toString())) return;
  try {
    let data = await prisma.config.findFirst({
      where: {
        type: ConfigType.AUTO_SEND_WITHDRAW,
      },
    });
    if (data) {
      await prisma.config.updateMany({
        where: {
          type: ConfigType.AUTO_SEND_WITHDRAW,
        },
        data: {
          is_enable: true,
        },
      });
    } else {
      await prisma.config.create({
        data: {
          is_enable: true,
        },
      });
    }
    await ctx.reply("Bật trả tự động thành công");
  } catch (error) {}
}

async function handleDisableWithdraw(ctx: any) {
  if (ctx.chat.id == env.GROUP_ID) return;
  if (!env.ADMIN_ID.split(",").includes(ctx.from.id.toString())) return;
  try {
    let data = await prisma.config.findFirst({
      where: {
        type: ConfigType.AUTO_SEND_WITHDRAW,
      },
    });
    if (data) {
      await prisma.config.updateMany({
        where: {
          type: ConfigType.AUTO_SEND_WITHDRAW,
        },
        data: {
          is_enable: false,
        },
      });
    } else {
      await prisma.config.create({
        data: {
          is_enable: false,
        },
      });
    }
    await ctx.reply("Tắt trả tự động thành công");
  } catch (error) {}
}

async function handleSetTime(ctx: any) {
  if (ctx.chat.id == env.GROUP_ID) return;
  if (!env.ADMIN_ID.split(",").includes(ctx.from.id.toString())) return;
  try {
    ctx.scene.enter(FLOW_SET_TIME);
  } catch (error) {}
}

async function handleCheckUser(ctx: any) {
  if (ctx.chat.id == env.GROUP_ID) return;
  if (!env.ADMIN_ID.split(",").includes(ctx.from.id.toString())) return;
  try {
    ctx.scene.enter(FLOW_CHECK_USER);
  } catch (error) {}
}

async function handleCheckAddress(ctx: any) {
  if (ctx.chat.id == env.GROUP_ID) return;
  if (!env.ADMIN_ID.split(",").includes(ctx.from.id.toString())) return;
  try {
    ctx.scene.enter(FLOW_CHECK_ADDRESS);
  } catch (error) {}
}

async function configLock(status: boolean) {
  const signer = new ethers.Wallet(env.OWNER_KEY, provider);
  const price = await getGasPrice();
  const contract = await getErc20Contract(env.TOKEN_CONTRACT, signer);
  const transaction = await contract.setLock(status, {
    gasPrice: (price * 101n) / 100n,
  });
  await transaction.wait();
  return transaction.hash;
}
