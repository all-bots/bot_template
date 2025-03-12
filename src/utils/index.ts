import "dotenv/config";
import { Redis } from "ioredis";
import { CURRENCY } from "./consts";
import { Crypto_Service, PrismaClient } from "@prisma/client";
import { Scenes } from "telegraf";
import Binance from "binance-api-node";
import { ethers, HDNodeWallet, Mnemonic } from "ethers";
import QRCode from "qrcode";
import fs from "fs";
import env from "./env";

export function getCurrentDate() {
  let now = new Date();
  let month = now.getUTCMonth() + 1;
  // month = month < 10 ? '0' + month : month
  let date = now.getUTCDate();
  return `${now.getUTCFullYear()}-${month < 10 ? "0" + month : month}-${
    date < 10 ? "0" + date : date
  }T00:00:00.000Z`;
}

export function getNextDay() {
  let now = new Date();
  now.setDate(now.getDate() + 1);
  return now.toISOString();
}

const client = Binance();
export const getPrice = async (symbol: string): Promise<number> => {
  let data = await client.prices({ symbol: `${symbol}USDT` });
  return Number(data[`${symbol}USDT`]);
};

export function generateAddress() {
  const { address, privateKey } = ethers.Wallet.createRandom();
  return { address: address, privateKey: privateKey };
}

export async function sendQRCode(ctx: Scenes.WizardContext, data: string) {
  let fileName = `${data}.png`;
  await QRCode.toFile(fileName, data);
  await ctx.replyWithPhoto({ source: fileName });
  fs.rmSync(fileName);
}

export function numberWithCommas(x) {
  let arr = x.toString().split(".");
  if (arr.length == 1)
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${arr[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${arr[1]}`;
}

export function makeRefLink(chatId: string) {
  return `t.me/[${env.BOT_NAME}]?start=${chatId}`;
}

export function getRndInteger(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const getTimeLeft = (timeEnd: string) => {
  let time = new Date(timeEnd).getTime() - new Date().getTime();
  let m = Math.ceil(time / 60000);
  let h = Math.floor(m / 60);
  m -= h * 60;
  m = h == 0 && m == 0 ? 1 : m;
  return `${h > 0 ? `${h} hours` : ""} ${m > 0 ? `${m} minutes` : ""}`;
};

const redisOptions = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times: number) => {
    // reconnect after
    return Math.min(times * 50, 2000);
  },
};
export const publisher = new Redis(redisOptions);

export function getCurrency(currencyOption: string) {
  let symbol = "";
  let service: Crypto_Service;
  switch (currencyOption) {
    case CURRENCY.ETH:
      symbol = "ETH";
      service = Crypto_Service.ETHEREUM;
      break;
    case CURRENCY.USDT_ERC20:
      symbol = "USDT";
      service = Crypto_Service.ETHEREUM;
      break;
    case CURRENCY.BNB:
      symbol = "BNB";
      service = Crypto_Service.BSC;
      break;
    case CURRENCY.USDT_BEP20:
      symbol = "USDT";
      service = Crypto_Service.BSC;
      break;
    case CURRENCY.BUSD:
      symbol = "BUSD";
      service = Crypto_Service.BSC;
      break;
  }
  return {
    symbol,
    service,
  };
}

export function generateWallet(phrase: string, index: number) {
  try {
    const wallet = HDNodeWallet.fromMnemonic(
      Mnemonic.fromPhrase(phrase),
      `m/44'/60'/0'/0/${index}`,
    );
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
    };
  } catch (error) {
    return {
      address: "",
      privateKey: "",
    };
  }
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function saveMessage(prisma: PrismaClient, msg: any) {
  await prisma.messageBot.create({
    data: {
      chatId: msg.chat.id.toString(),
      messageId: msg.message_id.toString(),
      content: msg.text,
    },
  });
}
