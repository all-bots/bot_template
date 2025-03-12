import { TransactionStatus, TransactionType } from "@prisma/client";
import { prisma } from "../../utils/db";
import { getMiningRate } from "../../helpers/mining";

export async function withdraw(req, res) {
  const { address, from_date: fromDate, chatId } = req.query;
  const [sum, miningRate] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        address: {
          mode: "insensitive",
          equals: address.toLowerCase(),
        },
        updatedAt: {
          gte: fromDate,
        },
      },
      _sum: {
        amount: true,
      },
    }),
    getMiningRate(prisma, chatId),
  ]);
  return res.json({ total: sum._sum.amount || 0, miningRate });
}

export async function getWalletWithdraw(req, res) {
  try {
    const { chatId } = req.params;
    const user = await prisma.user.findFirst({
      where: {
        chatId,
      },
    });
    if (!user) {
      return res.json({
        isError: false,
        message: `Không tồn tại chatId (${chatId}) bên bot X`,
        wallets: [],
      });
    }
    const transactions = await prisma.transaction.findMany({
      where: {
        type: TransactionType.WITHDRAW,
        status: TransactionStatus.APPROVED,
        userId: user.id,
      },
    });
    return res.json({
      isError: false,
      message: "",
      wallets: transactions.map((item) => item.address.toLowerCase()),
    });
  } catch (error) {
    return res.json({
      isError: true,
      message: error.message,
      wallets: [],
    });
  }
}
