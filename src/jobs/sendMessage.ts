import axios from "axios";
import fs from "fs";

async function main() {
  const PARALLEL = 5;
  const BATCH_SIZE = 50;
  let message = `
💰 Mining *750 X tokens* for *FREE* every day\\.

🎁 *FREE* instant withdrawal to your wallet\\.

🔥 Mining rate per day will increase to *150 X tokens/referral*\\.

Start now  👉 https://t\\.me/X\\_mining\\_bot 👈`;
  let data = JSON.parse(
    fs.readFileSync("data_bot/users_voption_airdrop.json", "utf8").toString()
  );
  let users = data.users;
  // let users = [...Array(1).keys()].map((i) => ({
  //   chatId: 1210753029,
  // }));
  let length = users.length;
  let size = BATCH_SIZE * PARALLEL;
  let maxIndex = Math.ceil(length / size);
  console.log("🚀 ~ file: sendMessage.ts:26 ~ main ~ maxIndex:", maxIndex);
  let ids = [];
  for (let i = 0; i < maxIndex; i++) {
    let start = i * size;
    let rs = await Promise.all(
      [...Array(PARALLEL).keys()].map(async (index) =>
        sendNotify(
          data.token,
          users.slice(
            start + index * BATCH_SIZE,
            start + (index + 1) * BATCH_SIZE
          ),
          message
        )
      )
    );
    console.log("DONE", i, maxIndex);
    for (let item of rs) {
      ids = [...ids, ...item];
    }
  }
  fs.writeFileSync("users_voption_airdrop.json", JSON.stringify(ids, null, 2));
}

async function sendNotify(token: string, users: any[], message: string) {
  // let flag = `time_${Math.random()}`;
  // console.time(flag);
  // let i = 0;
  // let length = users.length;
  let ids = [];
  for (let user of users) {
    let rs = await sendMessage(token, user.chatId.toString(), message);
    if (!rs) ids.push(user.chatId);
    await new Promise((resolve) => setTimeout(resolve, 400));
    // console.log(`Done ${(i + 1) % length} / ${length}`);
    // i++;
  }
  return ids;
  // console.timeEnd(flag);
}

main();

async function sendMessage(botToken: string, chatId: any, message: string) {
  try {
    let url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    let params = {
      chat_id: chatId,
      text: message,
      parse_mode: "markdownv2",
    };
    await axios.get(url, { params });
    return true;
  } catch (error) {
    console.log(
      "sendMessage: ",
      chatId,
      error?.response?.data?.description || error.message
    );
    return false;
  }
}
