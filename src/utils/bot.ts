import fs from "fs";
import fetch from "node-fetch";
import env from "./env";
import { sleep } from ".";
import axios from "axios";
import { prisma } from "./db";
import FormData from "form-data";

export async function sendMessage(
  botToken: string,
  chatId: any,
  message: string,
  btnReply: string = "",
) {
  try {
    let url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    // let params = {
    //     chat_id: chatId,
    //     text: message
    // }
    let params: any;
    if (btnReply) {
      params = {
        chat_id: chatId,
        text: message,
        reply_markup: {
          keyboard: [[{ text: btnReply }]],
        },
      };
    } else {
      params = {
        chat_id: chatId,
        text: message,
      };
    }
    const data = await axios.post(url, params);
    if (data.data.ok) {
      await prisma.messageBot.create({
        data: {
          messageId: data.data.result.message_id.toString(),
          chatId: chatId.toString(),
          content: message,
        },
      });
    }
  } catch (error) {
    // console.log("sendMessage: ", error)
  }
}

export async function sendMessageWithMenu(
  botToken: string,
  chatId: any,
  message: string,
  menu?: any,
) {
  try {
    let url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    let params = {
      chat_id: chatId,
      text: message,
      ...menu,
    };
    const data = await axios.post(url, params);
    if (data.data.ok) {
      await prisma.messageBot.create({
        data: {
          messageId: data.data.result.message_id.toString(),
          chatId: chatId.toString(),
          content: message,
        },
      });
    }
  } catch (error) {
    // console.log("sendMessageWithMenu: ", error);
  }
}

export async function sendPhoto(
  botToken: string,
  chatId: any,
  linkFile: string,
) {
  try {
    let url = `https://api.telegram.org/bot${botToken}/sendPhoto`;
    let formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("photo", await fs.createReadStream(linkFile));
    const request_config = {
      method: "post",
      headers: formData.getHeaders(),
      body: formData,
    };
    await fetch(url, request_config);
  } catch (err: any) {
    console.log(
      "🚀 ~ file: notify-order-round.ts:162 ~ chatIds.split ~ err",
      err,
    );
  }
}

export async function sendNotifyAdmin(content: string) {
  env.ADMIN_ID.split(",").forEach(async (id) => {
    await sendMessage(env.TOKEN_BOT_NOTIFY, id, content);
    await sleep(500);
  });
}

export async function forwardMessage(
  botToken: string,
  fromName: string,
  targetName: string,
  messageId: number,
) {
  try {
    let url = `https://api.telegram.org/bot${botToken}/forwardMessage`;
    await axios.get(url, {
      params: {
        chat_id: `@${targetName}`,
        from_chat_id: `@${fromName}`,
        message_id: messageId,
      },
    });
  } catch (error) {
    console.log(error);
  }
}
