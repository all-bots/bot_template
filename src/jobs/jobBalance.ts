import { Prisma } from "@prisma/client";
import { prisma } from "../utils/db";
import { Redis } from "ioredis";

const redisOptions = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times: number) => {
    // reconnect after
    return Math.min(times * 50, 2000);
  },
};
const publisher = new Redis(redisOptions);

async function main() {
  let balances = await prisma.$queryRaw<any[]>(Prisma.sql`
  select chat_id, sum(amount) as amount from "wallet_change" 
  INNER JOIN "user" ON "wallet_change".user_id = "user".id
  where type IN ('REFFERAL_MINE_TOKEN','MINE_TOKEN') 
    GROUP by chat_id
`);
  let data = balances.map((item) => ({
    chatId: item.chat_id,
    amount: item.amount,
  }));
  await publisher.publish("update-balance", JSON.stringify(data));
  console.log("done");
}

main();
// const delay = (ms) => new Promise((res) => setTimeout(res, ms));
