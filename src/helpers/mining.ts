import "dotenv/config";
import {
  PrismaClient,
  KycStatus,
  TransactionType,
  TransactionStatus,
  Prisma,
  User,
} from "@prisma/client";
import env from "../utils/env";

export async function getTotalEarning(prisma: PrismaClient, chatId: string) {
  let user = await prisma.user.findFirst({
    where: {
      chatId,
    },
    include: {
      Transaction: {
        where: {
          type: TransactionType.BUY_PACKAGE,
          status: TransactionStatus.APPROVED,
        },
      },
    },
  });
  return (
    user.Transaction.reduce((total, item) => total + item.amount, 0) *
      env.PROFIT_BONUS_PACKAGE +
    (user.status === KycStatus.APPROVED ? env.MINE_RATE : 0)
  );
}

export async function getMiningRate(prisma: PrismaClient, chatId: string) {
  let user = await prisma.user.findFirst({
    where: {
      chatId,
    },
    include: { Ref: { where: { status: KycStatus.APPROVED } } },
  });
  const [miningPackage, miningChildren] = await Promise.all([
    getMiningPackage(prisma, user),
    getMiningPackageChild(
      prisma,
      user.Ref.map((ref) => ref.id),
    ),
  ]);
  let amount = env.MINE_RATE;
  return (
    amount * user.Ref.length * env.RATE_REFFERAL +
    amount +
    miningPackage +
    miningChildren
  );
}

export async function getMiningPackage(prisma: PrismaClient, user: User) {
  try {
    let transactions = await prisma.$queryRaw<
      { event_id: string; amount: number; amount_sent: number }[]
    >(Prisma.sql`
  WITH sent AS (
    SELECT
      event_id,
      sum(amount) AS amount_sent
    FROM
      wallet_change
    WHERE
      user_id::text = ${user.id}
      AND type = 'PACKAGE'
    GROUP BY
      event_id
  )
  SELECT
  "transaction".id as event_id,
    amount,
    COALESCE(amount_sent, 0) as amount_sent
  FROM
    "transaction"
    LEFT JOIN sent ON "transaction".id::text = sent.event_id::text
  WHERE status = 'APPROVED'
    AND type = 'BUY_PACKAGE'
    AND user_id::text= ${user.id}
  `);
    if (transactions.length == 0) return 0;
    let total = transactions.reduce((total, transaction) => {
      let max = transaction.amount * env.PROFIT_BONUS_PACKAGE;
      if (transaction.amount_sent < max) {
        let amount =
          transaction.amount + transaction.amount_sent <= max
            ? transaction.amount
            : max - transaction.amount_sent;
        total += amount;
      }
      return total;
    }, 0);
    return total;
  } catch (error) {
    console.log("🚀 ~ file: mining.ts:92 ~ sendBonusPackage ~ error:", error);
    return 0;
  }
}

export async function getMiningPackageChild(
  prisma: PrismaClient,
  users: string[],
) {
  try {
    if (users.length == 0) return 0;
    let transactions = await prisma.$queryRaw<
      { event_id: string; amount: number; amount_sent: number }[]
    >(Prisma.sql`
  WITH sent AS (
    SELECT
      event_id,
      sum(amount) AS amount_sent
    FROM
      wallet_change
    WHERE
      user_id::text in (${Prisma.join(users)})
      AND type = 'PACKAGE'
    GROUP BY
      event_id
  )
  SELECT
  "transaction".id as event_id,
    amount,
    COALESCE(amount_sent, 0) as amount_sent
  FROM
    "transaction"
    LEFT JOIN sent ON "transaction".id::text = sent.event_id::text
  WHERE status = 'APPROVED'
    AND type = 'BUY_PACKAGE'
    AND user_id::text in (${Prisma.join(users)})
  `);
    if (transactions.length == 0) return 0;
    let total = transactions.reduce((total, transaction) => {
      let max = transaction.amount * env.PROFIT_BONUS_PACKAGE;
      if (transaction.amount_sent < max) {
        let amount =
          transaction.amount + transaction.amount_sent <= max
            ? transaction.amount
            : max - transaction.amount_sent;
        total += amount;
      }
      return total;
    }, 0);
    return total * env.RATE_REFFERAL;
  } catch (error) {
    console.log(
      "🚀 ~ file: sendBonus.ts:92 ~ sendBonusPackage ~ error:",
      error,
    );
    return 0;
  }
}
