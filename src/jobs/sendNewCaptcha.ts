import { prisma } from "../utils/db";
import { sendMessage, sendPhoto } from "../utils/bot";
import env from "../utils/env";
import { CaptchaType, LockCaptcha } from "@prisma/client";
import { genCaptcha, genCaptchaSvg } from "../helpers/captcha";
import fs from "fs";

const BATCH_SIZE = 20;
const PARALLEL = 10;

async function sendNewCaptcha(data: LockCaptcha[]) {
  for (let item of data) {
    await sendCaptcha(item);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function sendCaptcha(lock: LockCaptcha) {
  let genNewCaptcha: any;
  let message = "";
  if (lock.type == CaptchaType.CAPTCHA) {
    genNewCaptcha = genCaptcha;
    message = "Enter the captcha below";
  } else {
    genNewCaptcha = genCaptchaSvg;
    message = "Enter the result of this calculation:";
  }

  const captcha = await genNewCaptcha();
  let fileName = `${lock.chatId}.png`;
  fs.writeFileSync(fileName, captcha.image.source, "base64");
  await sendMessage(env.BOT_TOKEN, lock.chatId, message);
  await Promise.all([
    sendPhoto(env.BOT_TOKEN, lock.chatId, fileName),
    prisma.lockCaptcha.update({
      where: {
        id: lock.id,
      },
      data: {
        isCheck: true,
        code: captcha.value,
      },
    }),
  ]);
  fs.rmSync(fileName);
}

export async function main() {
  try {
    let now = new Date();
    let data = await prisma.lockCaptcha.findMany({
      where: {
        isCheck: false,
        time: `${now.getUTCHours()}:${now.getUTCMinutes()}`,
      },
    });
    if (data.length == 0) {
      process.exit();
    }

    let size = PARALLEL * BATCH_SIZE;
    let length = Math.ceil(data.length / size);
    for (let index = 0; index < length; index++) {
      let start = index * size;

      await Promise.all(
        [...Array(PARALLEL).keys()].map(async (i) =>
          sendNewCaptcha(
            data.slice(
              start + i * BATCH_SIZE,
              start + i * BATCH_SIZE + BATCH_SIZE
            )
          )
        )
      );
    }

    process.exit();
  } catch (err) {
    console.log(err);
    process.abort();
  }
}

try {
  main();
} catch (error) {
  console.log(error);
}
