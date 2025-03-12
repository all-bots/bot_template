import { prisma } from "../utils/db"
import { getBalance } from "../handlers/menu"
import fs from "fs"

async function main() {
  let users = await prisma.user.findMany()
  let index = 0
  let arr: string[] = []
  for (let user of users) {
    let balance = await getBalance(user.id)
    console.log(++index, users.length)
    if (balance < 0) {
      console.log(user.firstName, balance)
      arr.push(user.chatId)
    }
  }
  fs.writeFileSync("balance.json", JSON.stringify(arr, null, 2))
}

main()
