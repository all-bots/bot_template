import { ethers } from "ethers";
import { getErc20Contract } from "../helpers/contract-accessor";
import env from "../utils/env";
import { getProvider } from "../helpers/providers";
import { generateWallet } from "../utils";
const PHRASE =
  "tree ill evolve spoon spend winner bind swift small almost host law";
async function main() {
  try {
    let wallet = new ethers.Wallet(
      env.MASTER_WALLET_PRIVATE_KEY,
      getProvider(),
    );

    let contract = getErc20Contract(env.TOKEN_CONTRACT, wallet);

    let reciepts = [];
    let start = 1800;
    for (let i = start; i < start + 200; i++) {
      let wallet = generateWallet(PHRASE, i);
      if (wallet.address) {
        reciepts.push(wallet.address);
      }
    }
    let amounts = reciepts.map((i) => ethers.parseEther("750"));
    console.log("🚀 ~ file: sendToken.ts:25 ~ main ~ amounts:", amounts.length);
    console.log(
      "🚀 ~ file: sendToken.ts:25 ~ main ~ amounts:",
      reciepts.length,
    );

    let tx = await contract.mintToken(reciepts, amounts);
    console.log("tx hash: ", tx.hash);
    await tx.wait();
    // hash = transaction.transactionHash;
  } catch (error) {
    console.log("🚀 ~ file: sendToken.ts:33 ~ main ~ error:", error);
  }
}

main().catch((error) => {
  console.log("mine token error:", error);
});
