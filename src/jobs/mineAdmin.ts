import fs from "fs";
import "dotenv/config";
import { sendNotifyAdmin } from "../utils/bot";
import { prisma } from "../utils/db";
import { PATH_USER_ADMIN } from "./createUserAdmin";
import { TransactionType } from "@prisma/client";
import { getNextDay, getRndInteger } from "../utils";
import env from "../utils/env";

export async function mineAdmin() {
  console.log("Job run: ", new Date().toISOString());
  try {
    let users: string[] = [];

    if (fs.existsSync(PATH_USER_ADMIN)) {
      users = JSON.parse(
        fs.readFileSync(PATH_USER_ADMIN).toString(),
      ) as string[];
    }
    console.log(
      "🚀 ~ file: mineAdmin.ts:21 ~ mineAdmin ~ users.length :",
      users.length,
    );
    if (users.length > 0) {
      let addresses = [
        "0x217573df519452199A441771A5278b181226d628",
        "0x16026c1B5524474C202B09d17dab579b22876696",
        "0xBAa2F189d2082C25aD23637cC393D9FF585918fd",
        "0x34e56CB4a173587401f9306f2243b7F779DEC169",
        "0x3a28c4541E83B1b9017CDFb500c63c885f772E4b",
        "0x2d74d62BD5DDBB161d0a950432A37b92b59d3C84",
        "0x36E67d52F684535eD1CDfc362DA67aa7464B6483",
        "0x40e4d68c1945a7e8256834cc526F9924fF8A3F09",
        "0x69153a1720E7BBF50C48e6C91dCe5CC8BC836F20",
        "0x15181Df53B127c032ff552E747fe0AaDF953e37a",
        "0xc2bBf0a4F2e9921E6cE984322688c02B76ba3BDE",
        "0x73d987DDF99655dEE7C62C934FF38dd35a465423",
        "0x9e7faFC5a8DA681A281c907C3B56C2401eb362B2",
        "0xB86408eCe53011c28c993Cc49de313E39b951420",
        "0xbFDF555980C8d16Cd260622a342aaeA2379832a0",
        "0x9a41AD27c63ff8597a8880C0704Eb7684aC3BeF1",
        "0x37F3233F0Bf9755bB15c8e3DC675340AD144b114",
        "0x21C6bBE0546edcD70DF5d9e4C5b5146D7a7A3306",
        "0x6CbaF82Ff92bdEE413d21c87C4265239f4356DDE",
        "0x08dD76E4A2C8f2Ec898FaCFE5A5637474A03C230",
      ];
      let now = new Date();
      let transactions = addresses.map((address) => ({
        userId: users[getRndInteger(1, users.length) - 1],
        amount: env.MINE_RATE * getRndInteger(270, 400),
        type: TransactionType.WITHDRAW,
        expiration_date: getNextDay(),
        address,
        timeCreate: `${now.getUTCHours()}:${now.getUTCMinutes()}`,
      }));
      let data = await prisma.transaction.createMany({
        data: transactions,
      });
      console.log("🚀 ~ file: mineAdmin.ts:55 ~ mineAdmin ~ data:", data);
    }
    console.log("done");
  } catch (error) {
    console.log("🚀 ~ file: mineAdmin.ts:89 ~ mineAdmin ~ error:", error);
    await sendNotifyAdmin("tạo user admin lỗi: " + error.message);
  }
  console.log("done");
}

mineAdmin();
