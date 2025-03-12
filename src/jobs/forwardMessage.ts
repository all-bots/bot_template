// import mongoose from "mongoose"
import { forwardMessage } from "../utils/bot";
import fs from "fs";
import { prisma } from "../utils/db";
import env from "../utils/env";
import { ConfigType } from "@prisma/client";
const path_index = "index.txt";
// const path_index = "index.txt"
const TIME_START = 1692352800000;
export async function forwardMessageJob() {
  try {
    let now = new Date();
    console.log(now.toISOString(), "handle job forward Message start");
    try {
      let config = await prisma.config.findFirst({
        where: { type: ConfigType.AUTO_FORWARD },
      });
      if (!config) {
        process.exit();
        return;
      }
      let time = Math.floor((new Date().getTime() - TIME_START) / 60000);
      if (time % config.time != 0) {
        process.exit();
        return;
      }

      let data_index: { index: number } = { index: 0 };
      if (fs.existsSync(path_index)) {
        data_index = JSON.parse(fs.readFileSync(path_index).toString());
      }
      const messages = await prisma.message.findMany();
      if (messages.length > 0) {
        let index = 0;
        if (data_index.index < messages.length) {
          await new Promise((r) =>
            setTimeout(r, Math.ceil(Math.random() * 20 + 5) * 1000)
          );
          await forwardMessage(
            env.TOKEN_BOT_NOTIFY,
            "mineX_network_channel",
            "mineX_network",
            Number(messages[data_index.index].messageId)
          );
          index = data_index.index + 1;
          if (index >= messages.length) {
            index = 0;
          }
        }
        data_index.index = index;
        await fs.writeFileSync(path_index, JSON.stringify(data_index));
      }
    } catch (error) {
      console.log(error);
    }
    console.log("Done");
    process.exit();
  } catch (err) {
    console.log(err);
    process.abort();
  }
}

try {
  forwardMessageJob();
} catch (error) {
  console.log(error);
}
