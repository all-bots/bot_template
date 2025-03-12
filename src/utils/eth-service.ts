import "dotenv/config";
// import ethers, { Wallet, utils, BigNumber as BN } from "ethers";
import { BigNumberish, ethers, Wallet } from "ethers";
import { NonceManager } from "@ethersproject/experimental";
import {
  getErc20Contract,
  getErc20ContractByChain,
} from "../helpers/contract-accessor";
import { getProvider, getProviderByChain } from "../helpers/providers";
import math from "../helpers/math";
import logger from "../helpers/logger";

export type ETHCryptoData = {
  gas_limit: number;
  contract_address: string;
  max_fee: number;
  min_eth_for_collect: string;
  rpc_urls: string[];
  chainId: string;
  chain: string;
};

export async function getTokenBalance(c_address: string, address: string) {
  const contract = getErc20Contract(c_address);
  return await contract.balanceOf(address);
}
export async function getEthBalance(address: string) {
  const provider = getProvider();
  return await provider.getBalance(address);
}
export async function getEthBalanceByChain(
  address: string,
  rpc_urls: string[],
) {
  const provider = getProviderByChain(rpc_urls);
  return await provider.getBalance(address);
}

export async function getBalanceByChainWithKey(
  private_key: string,
  crypto_data: ETHCryptoData,
) {
  const provider = getProviderByChain(crypto_data.rpc_urls);
  const wallet = new ethers.Wallet(private_key, provider);

  if (crypto_data.contract_address.length > 0) {
    const contract = getErc20ContractByChain(
      crypto_data.contract_address,
      crypto_data.rpc_urls,
      wallet,
    );
    return await contract.balanceOf(wallet.address);
  }
  return await provider.getBalance(wallet.address);
}

export async function getLogs(from_block: number, to_block: number) {
  const erc20Contract = getErc20Contract(process.env.BSC_USDT_ADDRESS);
  const filter = erc20Contract.filters.Transfer();
  const history = await erc20Contract.queryFilter(filter, from_block, to_block);

  return history;
}

export async function getLastBlock() {
  const provider = getProvider();
  return provider.getBlockNumber();
}

export async function getLastBlockByChain(rpc_urls: string[]) {
  const provider = getProviderByChain(rpc_urls);
  return provider.getBlockNumber();
}

export async function getGasPrice() {
  const provider = getProvider();
  return (await provider.getFeeData()).gasPrice;
}

// export async function sendTokenTransaction(
//   wallet_address: MainWalletAddress,
//   sc_address: string,
//   to_address: string,
//   amount: string,
//   gas_limit: string,
//   gas_price: string,
//   master_private_key: string,
// ) {
//   const master_wallet = new Wallet(master_private_key, getProvider())
//   const user_wallet = new Wallet(wallet_address.encrypt_data, getProvider())
//   const contract = getErc20Contract(sc_address, user_wallet)

//   const bnb_user_balance = await getEthBalance(wallet_address.address)
//   // let unit = await contract.estimateGas.transfer(to_address, amount)
//   // let gas = unit.mul(await getGasPrice())

//   if (bnb_user_balance.lte(utils.parseEther('0.001'))) {
//     logger.info(`[forward BNB user] adress: ${wallet_address.address}`)

//     try {
//       const tx_fee = await master_wallet.sendTransaction({
//         to: wallet_address.address,
//         value: utils.parseEther('0.001'),
//       })
//       await tx_fee.wait()
//     } catch (error) {
//       logger.error(`[forward BNB user] error: ${error}`)
//       return
//     }
//   }

//   // let nonce = await user_wallet.getTransactionCount()
//   try {
//     logger.info(`[forward user] adress: ${wallet_address.address}`)
//     // const index = await getBscTransactionIndex(wallet_address.address)

//     const tx = await contract.transfer(to_address, amount, {
//       // nonce: nonce + 1,
//       // gasLimit: gas_limit,
//       // gasPrice: gas_price + 100000,
//     })

//     await tx.wait()
//     return tx.hash
//   } catch (error) {
//     logger.error(`[sendTokenTransaction] error: ${error}`)
//     return
//   }
// }

export async function sendEthTransaction(
  from_address: string,
  private_key: string,
  to_address: string,
  amount: BigNumberish,
) {
  try {
    const wallet = new ethers.Wallet(private_key, getProvider());
    const tx = await wallet.sendTransaction({
      from: from_address,
      to: to_address,
      value: amount,
    });
    await tx.wait();
    return tx.hash;
  } catch (error) {
    logger.error(`[sendEthTransaction] error: ${error}`);
    return;
  }
}

export async function sendEthTransactionByChain(
  private_key: string,
  to_address: string,
  amount: BigNumberish,
  crypto_data: ETHCryptoData,
) {
  const wallet = new Wallet(
    private_key,
    getProviderByChain(crypto_data.rpc_urls),
  );
  //@ts-ignore
  const managedSigner = new NonceManager(wallet);
  // async function getNonce() {
  //   const c = await managedSigner.getTransactionCount();
  //   // managedSigner.incrementTransactionCount(c+1)

  //   return c + 1;
  // }

  // const gas_price = await estimate_gas_price(
  //   crypto_data.gas_limit,
  //   crypto_data.max_fee,
  //   crypto_data.rpc_urls
  // );

  // const gasPrice = BN.from(gas_price.toString());
  // const gasLimit = BN.from(crypto_data.gas_limit);

  if (crypto_data.contract_address.length > 0) {
    logger.info(
      `[sendEthTransactionByChain] send erc20 token to adress: ${to_address}`,
    );
    const contract = getErc20ContractByChain(
      crypto_data.contract_address,
      crypto_data.rpc_urls,
      wallet,
    );
    const tx = await contract.transfer(to_address, amount.toString(), {
      // gasLimit: gasLimit.toString(),
      // gasPrice: gasPrice.toString(),
      // nonce: getNonce(),
    });
    // console.log('hash', tx.hash)
    await wallet.provider.waitForTransaction(tx.hash);
    return tx.hash;
  } else {
    logger.info(
      `[sendEthTransactionByChain] send Coin to adress: ${to_address}`,
    );
    if (["GOERLI", "POLYGON"].includes(crypto_data.chain)) return null;
    const tx = await wallet.sendTransaction({
      to: to_address,
      value: amount,
    });
    console.log("hash", tx.hash);
    await tx.wait();
    return tx.hash;
  }
}

export async function estimate_gas_price(
  gas_limit: number,
  max_fee: number,
  rpc_urls: string[],
) {
  const provider = getProviderByChain(rpc_urls);
  const estimate_gas_price = (await provider.getFeeData()).gasPrice;

  const gas_price = math.mul(estimate_gas_price.toString(), 1.2);
  const estimate_fee = math.mul(gas_price, gas_limit);
  const max_fee_wei = ethers.parseUnits(max_fee.toString(), "gwei");
  if (estimate_fee.toNumber() > Number(max_fee_wei)) {
    return math
      .div(max_fee_wei.toString(), gas_limit.toString())
      .decimalPlaces(0);
  }
  return gas_price.decimalPlaces(0);
}

export async function getTokenBalanceByChain(
  rpc_urls: string[],
  c_address: string,
  address: string,
) {
  const contract = getErc20Contract(c_address, getProviderByChain(rpc_urls));
  return await contract.balanceOf(address);
}
