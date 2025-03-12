import { ethers } from "ethers";
import { getErc20Contract } from "../helpers/contract-accessor";
import env from "../utils/env";
import { getProvider } from "../helpers/providers";
import { prisma } from "../utils/db";
import "dotenv/config";
import {
  ConfigType,
  Transaction,
  TransactionStatus,
  TransactionType,
  User,
  WalletChangeType,
} from "@prisma/client";
import { sendMessage, sendNotifyAdmin } from "../utils/bot";
import fs from "fs";
import { getGasPrice } from "../utils/eth-service";
export type Result = Transaction & {
  User: User;
};

const BATCH = 30;
const PATH_LOCK = "lockAmount.json";
export async function main() {
  let now = new Date();
  let timeId = now.getTime();
  console.log("job start", now.toISOString());
  console.time(`job_${timeId}`);
  let transactionsUpdate: Result[] = [];
  let arr: any[] = [];
  let hash = "";
  try {
    let config = await prisma.config.findFirst({
      where: {
        type: ConfigType.AUTO_SEND_WITHDRAW,
      },
    });
    if (!config?.is_enable) {
      return;
    }
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
      orderBy: {
        createdAt: "asc",
      },
      // take: env.MAX_SEND,
    });
    const lockAmount = await getLockAmount();
    let data: any = {};
    for (let transaction of transactions) {
      if (Object.values(data).length == env.MAX_SEND) {
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
          transactionsUpdate.push(transaction);
        }
        continue;
      }
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
    // return;
    // fs.writeFileSync("data.json", JSON.stringify(arr, null, 2));
    if (arr.length != env.MAX_SEND) {
      process.exit();
    }
    let ids = transactionsUpdate.map((transaction) => transaction.id);
    let reciepts = arr.map((transaction) => transaction.address);
    const locks = reciepts.map((item) => {
      const amount = lockAmount[item] || 0;
      return ethers.parseEther(amount.toString());
    });
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

    const balance = await wallet.provider.getBalance(wallet.address);
    if (balance < ethers.parseEther("0.09")) {
      console.log("Không đủ BNB làm phí");
      await prisma.transaction.updateMany({
        where: {
          id: { in: ids },
        },
        data: {
          status: TransactionStatus.SUBMITTED,
        },
      });
      await sendNotifyAdmin("Không đủ BNB làm phí");
      console.timeEnd(`job_${timeId}`);
      process.exit();
    }

    let contract = getErc20Contract(env.TOKEN_CONTRACT, wallet);
    const price = await getGasPrice();
    let tx = await contract.mintToken2(reciepts, amounts, locks, {
      gasPrice: (price * 100n) / 100n,
    });
    console.log("tx hash: ", tx.hash);
    let transaction = await tx.wait();
    // let transaction = { transactionHash: "100" };
    hash = tx.hash;
    console.log("🚀 ~ file: mineToken.ts:109 ~ main ~ hash:", hash);
    if (transaction.hash) {
      let length = transactionsUpdate.length / BATCH;
      for (let index = 0; index < length; index++) {
        let arrUpdate = transactionsUpdate.slice(
          index * BATCH,
          (index + 1) * BATCH,
        );

        let walletChanges = arrUpdate.map((transaction) => ({
          userId: transaction.User.id,
          amount: -transaction.amount,
          type: WalletChangeType.WITHDRAW,
        }));
        let idUpdate = arrUpdate.map((transaction) => transaction.id);

        await prisma.walletChange.createMany({
          data: walletChanges,
        });
        await prisma.transaction.updateMany({
          where: {
            id: {
              in: idUpdate,
            },
          },
          data: {
            hash: transaction.hash,
            status: TransactionStatus.APPROVED,
          },
        });
      }

      // notify
      for (let transaction of transactionsUpdate) {
        //   await Promise.all([
        await sendMessage(
          env.BOT_TOKEN,
          transaction.User.chatId,
          "✅ Withdrawal successful! Please check your wallet.",
        );

        await delay(50);
        //     prisma.walletChange.create({
        //       data: {
        //         userId: transaction.User.id,
        //         amount: -transaction.amount,
        //         type: WalletChangeType.WITHDRAW,
        //       },
        //     }),
        //   ]);
        // }
        // await prisma.transaction.updateMany({
        //   where: {
        //     id: {
        //       in: ids,
        //     },
        //   },
        //   data: {
        //     hash: transaction.transactionHash,
        //     status: TransactionStatus.APPROVED,
        //   },
        // });
      }
    }
  } catch (error) {
    const time = new Date().toISOString();
    console.log(time, error.message);
    await sendNotifyAdmin(`${time}: send airdrop mineX error. check lock`);

    if (transactionsUpdate.length > 0) {
      let ids = transactionsUpdate.map((transaction) => transaction.id);
      if (hash) {
        console.log(
          "APPROVED",
          await prisma.transaction.updateMany({
            where: {
              id: {
                in: ids,
              },
            },
            data: {
              status: TransactionStatus.APPROVED,
            },
          }),
        );
      } else {
        console.log(
          "SUBMITTED",
          await prisma.transaction.updateMany({
            where: {
              id: {
                in: ids,
              },
            },
            data: {
              status: TransactionStatus.SUBMITTED,
            },
          }),
        );
      }
    }
  }
  console.timeEnd(`job_${timeId}`);
  process.exit();
}

async function getLockAmount() {
  if (!fs.existsSync(PATH_LOCK)) {
    const admins = JSON.parse(fs.readFileSync("user_admin.json").toString());
    let data = await prisma.transaction.groupBy({
      by: ["address"],
      _sum: {
        amount: true,
      },
      where: {
        type: TransactionType.WITHDRAW,
        status: TransactionStatus.APPROVED,
        userId: {
          notIn: admins,
        },
      },
    });
    const lockAmount = data
      .sort((a, b) => b._sum.amount - a._sum.amount)
      .reduce((obj, item) => {
        obj[item.address] = item._sum.amount || 0;
        return obj;
      }, {});
    fs.writeFileSync(PATH_LOCK, JSON.stringify(lockAmount, null, 2));
    return lockAmount;
  } else {
    return JSON.parse(fs.readFileSync(PATH_LOCK).toString());
  }
}

main().catch((error) => {
  console.log("mine token error:", error);
});

const delay = (ms) => new Promise((res) => setTimeout(res, ms));
