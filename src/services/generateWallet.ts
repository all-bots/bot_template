import "dotenv/config";
import rsmq from "rsmq-worker";
import { GENERATE_WALLET_QUEUE } from "../utils/redis";
import { prisma } from "../utils/db";
import env from "../utils/env";
import { moralisStreamAddress } from "../utils/moralis";
import Moralis from "moralis";
import { generateWallet } from "../utils";
import { sendNotifyAdmin } from "../utils/bot";

const redisHost = env.REDIS_HOST;

async function main() {
  await Moralis.start({ apiKey: env.MORALIS_API_KEY });
  const worker = new rsmq(GENERATE_WALLET_QUEUE, {
    host: redisHost,
    port: env.REDIS_PORT,
    timeout: 60000,
    options: { password: env.REDIS_PASSWORD },
  });

  worker.on("message", async function (msg: any, next: any, id: any) {
    try {
      let user = await prisma.user.findFirst({
        where: {
          id: msg,
        },
        include: {
          Wallet: true,
        },
      });
      if (!user) {
        next();
      }
      if (user?.Wallet) {
        next();
      }

      let max = await prisma.wallet.aggregate({
        _max: {
          indexWallet: true,
        },
      });
      let index = max._max.indexWallet == null ? -1 : max._max.indexWallet;
      index += 1;
      let newWallet = await generateWallet(env.PHRASE, index);
      if (newWallet.address && newWallet.privateKey) {
        let wallet = await prisma.wallet.findFirst({
          where: {
            userId: msg,
          },
        });
        if (!wallet) {
          await Promise.all([
            prisma.wallet.create({
              data: {
                userId: user.id,
                address: newWallet.address,
                indexWallet: index,
              },
            }),
            moralisStreamAddress(newWallet.address),
          ]);
        }
      }
      next();
    } catch (err) {
      await sendNotifyAdmin(`job gen wallet error: ${err.message}`);
      next();
    }
  });

  // optional error listeners
  worker.on("error", function (err: any, msg: any) {
    console.log("ERROR", err, msg.id);
  });
  worker.on("exceeded", function (msg: any) {
    console.log("EXCEEDED", msg.id);
  });
  worker.on("timeout", function (msg: any) {
    console.log("TIMEOUT", msg.id, msg.rc);
  });

  worker.start();
  console.log("start worker gen wallet");
}

main();
