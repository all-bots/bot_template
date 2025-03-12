import RSMQPromise from "rsmq-promise";
import "dotenv/config";
import env from "./env";
import RedisClient from "ioredis";

const configRedis = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
};

export interface TransferTokenData {
  tokenAddress: string;
  from: string;
  to: string;
  amount: number;
  userId: string;
  eventId: string;
  privateKeyMaster: string;
  isSave?: boolean;
}

export const redis = new RedisClient(configRedis);

const rsmq = new RSMQPromise(configRedis);

export const GENERATE_WALLET_QUEUE = "GENERATE_WALLET_BOT_X";

async function createQueue(queueName: string) {
  try {
    // create a queue
    await rsmq.createQueue({ qname: queueName });
    console.log(queueName + " Queue created!");
  } catch (err) {
    if (err.name == "queueExists") {
      console.log("queue exists.. resuming..");
    } else {
      console.log(err.name);
    }
  }
}

export async function initQueue() {
  await Promise.all([createQueue(GENERATE_WALLET_QUEUE)]);
}

export async function sendGenerateWalletMessage(data: string) {
  try {
    await rsmq
      .sendMessage({
        qname: GENERATE_WALLET_QUEUE,
        message: data,
      })
      .then((result) =>
        console.log("pushed new message into queue.. " + GENERATE_WALLET_QUEUE),
      );
  } catch (err) {
    console.log(err);
  }
}
