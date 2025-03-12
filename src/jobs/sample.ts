import { prisma } from "../utils/db";
import fs from "fs";

async function main() {
  let users = await prisma.user.findMany({
    where: {
      NOT: {
        username: "",
      },
    },
  });
  fs.writeFileSync("users.json", JSON.stringify(users, null, 2));
}

main().catch(console.error);
