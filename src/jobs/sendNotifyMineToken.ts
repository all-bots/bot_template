import { TransactionStatus, TransactionType, User } from "@prisma/client";
import { prisma } from "../utils/db";
import { sendMessage } from "../utils/bot";
import env from "../utils/env";
import { BTN } from "../utils/consts";

const BATCH_SIZE = 20;
const PARALLEL = 10;

async function sendNotifyMine(users: User[]) {
  for (let user of users) {
    await sendMessage(
      env.BOT_TOKEN,
      user.chatId.toString(),
      `Click "${BTN.MINE_TOKEN}" to mine X token`,
      BTN.MINE_TOKEN,
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

export async function main() {
  try {
    let now = new Date();
    const time = new Date(now.getTime() - 86500000);
    let transactions = await prisma.transaction.findMany({
      where: {
        status: TransactionStatus.SUBMITTED,
        type: TransactionType.MINE_TOKEN,
        timeCreate: `${now.getUTCHours()}:${now.getUTCMinutes()}`,
        createdAt: { gte: time },
      },
      include: { User: true },
    });
    console.log(
      "🚀 ~ file: sendNotifyMineToken.ts:33 ~ main ~ transactions:",
      `${now.getUTCHours()}:${now.getUTCMinutes()}`,
      transactions.length,
    );
    let users = transactions.map((item) => item.User);
    let size = PARALLEL * BATCH_SIZE;
    let length = Math.ceil(users.length / size);
    for (let index = 0; index < length; index++) {
      let start = index * size;

      await Promise.all(
        [...Array(PARALLEL).keys()].map(async (i) =>
          sendNotifyMine(
            users.slice(
              start + i * BATCH_SIZE,
              start + i * BATCH_SIZE + BATCH_SIZE,
            ),
          ),
        ),
      );
    }

    // process.exit();
  } catch (err) {
    console.log(err);
    // process.abort();
  }
}

main()
  .catch((err) => {
    console.log;
  })
  .finally(() => {
    process.exit();
  });
