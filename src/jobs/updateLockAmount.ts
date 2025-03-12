// import 'dotenv/config'
// import { ethers } from "ethers";
// import { prisma } from "../utils/db";
// import { TransactionStatus, TransactionType } from "@prisma/client";
// import { getErc20Contract, provider } from "../helpers/contract-accessor";
// import env from "../utils/env";

// export async function mineAdmin() {
//   console.log("Job run: ", new Date().toISOString());
//   let data = await prisma.transaction.groupBy({
//     by: ['address'],
//     _sum: {
//       amount: true,
//     },
//     where: {
//       type: TransactionType.WITHDRAW,
//       status: TransactionStatus.APPROVED,
//     },
//   })
//   let address: string[] = [], amount: ethers.BigNumber[] = []
//   data = data.slice(0, 300)
//   console.log(data.length)
//   for (let item of data){
//     address.push(item.address)
//     amount.push(ethers.utils.parseEther(item._sum.amount.toString()))
//   }
//   console.log(address.length, amount.length)
//   const wallet = new ethers.Wallet("6c46a321d8ff8bad074d46d6d53232c66bf8036f49ab04279b9274bbf2185cfb", provider)
//   const contract = getErc20Contract(env.TOKEN_CONTRACT, wallet)
//   const gasPrice = await provider.getGasPrice()
//   const transaction = await contract.updateMintAmount(address, amount, {
//     gasPrice:gasPrice.mul(105).div(100)
//   })
//   await transaction.wait()
//   console.log(transaction.hash)

//   console.log("done");
// }

// mineAdmin();
