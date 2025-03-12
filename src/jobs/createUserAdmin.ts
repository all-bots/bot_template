import fs from "fs";
import "dotenv/config";
import { sendNotifyAdmin } from "../utils/bot";
import { prisma } from "../utils/db";

export const PATH_USER_ADMIN = "user_admin.json";
export interface AdminUser {
  chatId: string;
  firstName: string;
  lastName: string;
}

export async function createUserAdmin() {
  console.log("Job run: ", new Date().toISOString());
  try {
    let users: AdminUser[] = [];

    if (fs.existsSync(PATH_USER_ADMIN)) {
      users = JSON.parse(
        fs.readFileSync(PATH_USER_ADMIN).toString(),
      ) as AdminUser[];
    }

    if (users.length == 0) {
      users = [
        {
          chatId: "5958923371",
          firstName: "Lambert",
          lastName: "Fintan",
        },
        {
          chatId: "4884820908",
          firstName: "Veronica",
          lastName: "Becker",
        },
        {
          chatId: "2874413338",
          firstName: "Henry",
          lastName: "Stanley",
        },
        {
          chatId: "371979760",
          firstName: "Rhonda",
          lastName: "Sutton",
        },
        {
          chatId: "4806916990",
          firstName: "Geraldine",
          lastName: "Roberson",
        },
        {
          chatId: "1538335485",
          firstName: "Raul",
          lastName: "Wells",
        },
        {
          chatId: "1305832253",
          firstName: "Brandi",
          lastName: "Austin",
        },
        {
          chatId: "7573482730",
          firstName: "Jon",
          lastName: "Lewis",
        },
        {
          chatId: "2883427932",
          firstName: "Dean",
          lastName: "Carroll",
        },
        {
          chatId: "177751243",
          firstName: "Melinda",
          lastName: "Walsh",
        },
      ];
      let ids: string[] = [];
      let now = new Date();
      for (let user of users) {
        let u = await prisma.user.create({
          data: {
            ...user,
            timeCreate: `${now.getUTCHours()}:${now.getUTCMinutes()}`,
          },
        });
        ids.push(u.id);
      }
      fs.writeFileSync(PATH_USER_ADMIN, JSON.stringify(ids, null, 2));
    }
  } catch (error) {
    console.log(
      "🚀 ~ file: createUserAdmin.ts:89 ~ createUserAdmin ~ error:",
      error,
    );
    await sendNotifyAdmin("tạo user admin lỗi: " + error.message);
  }
  console.log("done");
}

createUserAdmin();
