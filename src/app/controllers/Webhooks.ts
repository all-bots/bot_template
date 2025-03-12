import { ethers } from "ethers";
import {
  Erc20Transfer,
  MoralisStreamTransactions,
  Tx,
} from "../../utils/moralis";
import { prisma } from "../../utils/db";
import { Crypto_Service, Currency, TransactionStatus } from "@prisma/client";
import {
  sendMessage,
  sendMessageWithMenu,
  sendNotifyAdmin,
} from "../../utils/bot";
import { numberWithCommas, sleep } from "../../utils";
import env from "../../utils/env";
import { getMiningRate, getTotalEarning } from "../../helpers/mining";
import { ETHCryptoData } from "../../utils/eth-service";
import { getSellContract, provider } from "../../helpers/contract-accessor";
import { getListIdo } from "../../handlers/menu";
import { menuKeyboard } from "../../handlers/keyboard";

const sellContract = getSellContract(env.SELL_CONTRACT);

export async function monitorWallet(req, res) {
  const data: MoralisStreamTransactions = req.body;
  if (!data.confirmed)
    return res.status(200).json({ message: "Not confirmed" });
  const { erc20Transfers, txs } = data;

  if (!erc20Transfers.length && !txs.length)
    return res.status(200).json({ message: "No transactions" });
  let message = "";
  try {
    if (erc20Transfers.length) {
      await Promise.all(
        erc20Transfers.map(async (transfer) => {
          // if (data.chainId == "0x61" || data.chainId == "0x5") return;
          let chain = ["0x38", "0x61"].includes(data.chainId)
            ? Crypto_Service.BSC
            : Crypto_Service.ETHEREUM;
          const currency = await prisma.currency.findFirst({
            where: {
              symbol: transfer.tokenSymbol,
              crypto_service: chain,
            },
          });
          if (!currency) {
            message = "Missing currency";
            return;
          }
          const cryptoData = currency.crypto_data as ETHCryptoData;
          if (
            cryptoData.contract_address.toLowerCase() !=
            transfer.contract.toLowerCase()
          ) {
            message = "Missing currency";
            return;
          }
          const result = await processDepositErc20(transfer, currency);
          if (result?.update) {
            let mined = await getTotalEarning(prisma, result.chatId);
            let rate = await getMiningRate(prisma, result.chatId);
            await sendMessage(
              env.BOT_TOKEN,
              result.chatId,
              `🎉Congratulations! You have successfully upgraded the mining package. 
 
Total Earnings: ${numberWithCommas(mined)} X tokens (~\$${numberWithCommas(
                mined * env.PRICE_TOKEN,
              )}) 
Mining Rate: ${numberWithCommas(rate)} tokens/day
            `,
            );
          }
          if (result?.error) {
            message = result.message;
            return;
          }
        }),
      );
    } else if (txs.length) {
      await Promise.all(
        txs.map(async (tx) => {
          const currency = await prisma.currency.findFirst({
            where: {
              crypto_data: {
                path: ["chainId"],
                equals: data.chainId,
              },
            },
          });
          if (!currency) {
            message = "Missing currency";
            return;
          }
          const result = await processDepositToken(tx, currency);
          if (result?.error) {
            message = result.message;
            return;
          }
          if (result?.update) {
            let mined = await getTotalEarning(prisma, result.chatId);
            let rate = await getMiningRate(prisma, result.chatId);
            await sendMessage(
              env.BOT_TOKEN,
              result.chatId,
              `🎉Congratulations! You have successfully upgraded the mining package. 
 
Total Earnings: ${numberWithCommas(mined)} X tokens (~\$${numberWithCommas(
                mined * env.PRICE_TOKEN,
              )}) 
Mining Rate: ${numberWithCommas(rate)} tokens/day
            `,
            );
          }
        }),
      );
    }
    console.log(
      "🚀 ~ file: Webhooks.ts:98 ~ monitorWallet ~ message:",
      message,
    );
    if (message) {
      res.status(400).json({
        message,
      });
    } else {
      res.status(200).json({
        message: `Deposit success`,
      });
    }
  } catch (error) {
    console.log("🚀 ~ file: Webhooks.ts:111 ~ monitorWallet ~ error:", error);
    res.status(400).json({ error: true, message: error.message });
  }
}

export async function monitorIdo(req, res) {
  const data: MoralisStreamTransactions = req.body;
  if (!data.confirmed)
    return res.status(200).json({ message: "Not confirmed" });
  try {
    const { logs } = data;
    if (!logs.length) {
      return res.status(200).json({ message: "No transactions" });
    }
    const hash = logs[0].transactionHash;
    const exists = await prisma.idoLog.findFirst({
      where: {
        hash,
      },
    });
    if (!exists) {
      const transaction = await provider.getTransactionReceipt(hash);
      await handleBuyIdo(transaction);
    }
    return res.status(200).json({ message: "Done" });
  } catch (error) {
    const now = new Date().toISOString();
    console.log(now, "🚀 ~ file: Webhooks.ts:150 ~ monitorIdo ~ error:", error);
    await sendNotifyAdmin(`${now}: Log ido error`);
    res.status(400).json({ error: true, message: error.message });
  }
}

async function processDepositErc20(data: Erc20Transfer, currency: Currency) {
  const txExist = await prisma.transaction.findFirst({
    where: {
      hash: data.transactionHash,
      currencyId: currency.id,
    },
  });

  if (txExist)
    return {
      error: true,
      message: "Transaction already exist",
      update: false,
      chatId: "",
      amount: 0,
      eventId: "",
    };

  let transactions = await prisma.transaction.findMany({
    where: {
      status: TransactionStatus.SUBMITTED,
      currencyId: currency.id,
      address: {
        equals: data.to.toLowerCase(),
        mode: "insensitive",
      },
    },
    orderBy: {
      amountToken: "desc",
    },
    include: {
      User: true,
    },
  });
  let name = `${transactions[0]?.User?.firstName || ""} ${
    transactions[0]?.User?.lastName || ""
  }`;
  await sendNotifyAdmin(
    `User ${name || data.from} deposit ${ethers.formatEther(data.value)} ${
      currency.name
    } hash: ${data.transactionHash}`,
  );
  if (transactions.length == 0)
    return {
      error: false,
      message: "No transaction",
      update: false,
      chatId: "",
      amount: 0,
      eventId: "",
    };
  let update = false;
  let chatId = "";
  let amount = 0;
  let eventId = "";
  for (let index = 0; index < transactions.length; index++) {
    if (
      transactions[index].amountToken <= Number(ethers.formatEther(data.value))
    ) {
      await prisma.transaction.update({
        where: {
          id: transactions[index].id,
        },
        data: {
          status: TransactionStatus.APPROVED,
          hash: data.transactionHash,
        },
      });
      update = true;
      chatId = transactions[index].User.chatId;
      amount = transactions[index].amount;
      eventId = transactions[index].id;
      break;
    }
  }
  return { error: false, message: "Buy done", update, chatId, amount, eventId };
}

async function processDepositToken(data: Tx, currency: Currency) {
  const txExist = await prisma.transaction.findFirst({
    where: {
      hash: data.hash,
      currencyId: currency.id,
    },
  });

  if (txExist)
    return {
      error: true,
      message: "Transaction already exist",
      update: false,
      chatId: "",
      amount: 0,
      eventId: "",
    };

  let transactions = await prisma.transaction.findMany({
    where: {
      status: TransactionStatus.SUBMITTED,
      currencyId: currency.id,
      address: {
        equals: data.toAddress.toLowerCase(),
        mode: "insensitive",
      },
    },
    orderBy: {
      amountToken: "desc",
    },
    include: {
      User: true,
    },
  });
  await sendNotifyAdmin(
    `User ${
      transactions[0]?.User?.firstName || data.fromAddress
    } deposit ${ethers.formatEther(data.value)} ${currency.name}`,
  );
  if (transactions.length == 0)
    return {
      error: false,
      message: "No transaction",
      update: false,
      chatId: "",
      amount: 0,
      eventId: "",
    };
  let update = false;
  let chatId = "";
  let amount = 0;
  let eventId = "";
  for (let index = 0; index < transactions.length; index++) {
    console.log(
      transactions[index].amountToken,
      Number(ethers.formatEther(data.value)),
    );
    if (
      transactions[index].amountToken <= Number(ethers.formatEther(data.value))
    ) {
      await prisma.transaction.update({
        where: {
          id: transactions[index].id,
        },
        data: {
          status: TransactionStatus.APPROVED,
          hash: data.hash,
        },
      });
      update = true;
      chatId = transactions[index].User.chatId;
      amount = transactions[index].amount;
      eventId = transactions[index].id;
      break;
    }
  }
  return { error: false, message: "Buy done", update, chatId, amount, eventId };
}

async function handleBuyIdo(transaction: ethers.TransactionReceipt) {
  const logs = transaction.logs.filter(
    (log) => log.address.toLowerCase() == env.SELL_CONTRACT.toLowerCase(),
  );
  if (!logs.length) {
    return false;
  }
  for (let log of logs) {
    const dataLog = await sellContract.interface.parseLog({
      data: log.data,
      topics: log.topics,
    });

    const user = dataLog.args["user"] as string;
    if (["SellU", "SellB"].includes(dataLog.name)) {
      await prisma.idoLog.create({
        data: {
          address: user,
          hash: transaction.hash,
          idoType: dataLog.name == "SellB" ? "BNB" : "USD",
        },
      });
      if (dataLog.name == "SellU") {
        const token = ethers.formatEther(dataLog.args["sell_amount"]);
        const usd = ethers.formatEther(dataLog.args["buy_amount"]);
        await sendNotifyAdmin(
          `${user} dùng ${numberWithCommas(
            usd,
          )} USD mua được ${numberWithCommas(token)} X`,
        );
      } else {
        const token = ethers.formatEther(dataLog.args["sell_amount"]);
        const bnb = ethers.formatEther(dataLog.args["buy_amount_bnb"]);
        await sendNotifyAdmin(
          `${user} dùng ${numberWithCommas(
            bnb,
          )} BNB mua được ${numberWithCommas(token)} X`,
        );
      }
      const list = await getListIdo();
      if (list.length > 0) {
        const users = await prisma.transaction.findMany({
          distinct: ["userId"],
          where: {
            type: "WITHDRAW",
            status: "APPROVED",
            address: {
              mode: "insensitive",
              equals: user.toLowerCase(),
            },
          },
          select: {
            User: {
              select: { chatId: true },
            },
          },
        });
        for (let user of users) {
          await sendMessageWithMenu(
            env.BOT_TOKEN,
            user.User.chatId,
            list,
            menuKeyboard.reply(),
          );
          await sleep(500);
        }
      }
    }
  }
}
