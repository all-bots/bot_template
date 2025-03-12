import "dotenv/config";
import { prisma } from "../utils/db";
import fs from "fs";
// stderr is sent to stderr of parent process
// you can set options.stdio if you want it to go elsewhere
async function main() {
  try {
    console.time("backup");
    console.log("start ", new Date().toISOString());
    // let [user, transaction, walletChange, code, lockCaptcha, logMine] =
    // await Promise.all([
    const code = await prisma.code.findMany();
    console.log("🚀 ~ main ~ code:", code.length);
    fs.writeFileSync("data/code.json", JSON.stringify(code, null, 4));

    const config = await prisma.config.findMany();
    console.log("🚀 ~ main ~ config:", config.length);
    fs.writeFileSync("data/config.json", JSON.stringify(config, null, 4));

    const lockCaptcha = await prisma.lockCaptcha.findMany();
    console.log("🚀 ~ main ~ lockCaptcha:", lockCaptcha.length);
    fs.writeFileSync(
      "data/lockCaptcha.json",
      JSON.stringify(lockCaptcha, null, 4),
    );

    const logMine = await prisma.logMine.findMany();
    console.log("🚀 ~ main ~ logMine:", logMine.length);
    fs.writeFileSync("data/logMine.json", JSON.stringify(logMine, null, 4));

    const transaction = await prisma.transaction.findMany();
    console.log("🚀 ~ main ~ transaction:", transaction.length);
    fs.writeFileSync(
      "data/transaction.json",
      JSON.stringify(transaction, null, 4),
    );

    const user = await prisma.user.findMany();
    console.log("🚀 ~ main ~ user:", user.length);
    fs.writeFileSync("data/user.json", JSON.stringify(user, null, 4));

    const walletChange = await prisma.walletChange.findMany();
    console.log("🚀 ~ main ~ walletChange:", walletChange.length);
    fs.writeFileSync(
      "data/walletChange.json",
      JSON.stringify(walletChange, null, 4),
    );
    // ]);
    // fs.writeFileSync('data/wallet.json', JSON.stringify(wallet, null, 4))
    // fs.writeFileSync('data/currency.json', JSON.stringify(currency, null, 4))
    console.log("done");
    console.timeEnd("backup");
  } catch (error) {
    console.log("error", error);
  }
}

main();
