import Moralis from "moralis";
import { EvmChain } from "@moralisweb3/common-evm-utils";
import { BigNumberish } from "ethers";
import "dotenv/config";
import env from "./env";
// import { Currency } from '@prisma/client'
import { ETHCryptoData } from "./eth-service";

export interface CryptoData {
  chain: string;
  chainId: string;
  max_fee: number;
  rpc_urls: string[];
  gas_limit: number;
  contract_address: string;
  min_eth_for_collect: string;
}

export async function moralisStreamAddress(address: string) {
  console.log("Add address to Moralis stream", address);
  try {
    const streamId = env.MORALIS_STREAM_ID;
    await Moralis.Streams.addAddress({
      address,
      id: streamId,
    });
    return true;
  } catch (error) {
    console.log(
      "🚀 ~ file: moralis-v2-utils.ts:39 ~ moralisStreamAddress ~ error:",
      error,
    );
    return false;
  }
}

export async function getNativeBalance(
  address: string,
  currency: any,
): Promise<BigNumberish> {
  const crypto_data = currency.crypto_data as ETHCryptoData;
  const chain = crypto_data.chain;
  const nativeBalance = await Moralis.EvmApi.balance.getNativeBalance({
    chain: EvmChain[chain],
    address: address,
  });
  return nativeBalance.toJSON().balance;
}

export async function getWalletTokenBalances(
  address: string,
  tokenAddresses: string[],
  currency: any,
) {
  const crypto_data = currency.crypto_data as ETHCryptoData;
  const chain = crypto_data.chain;
  const response = await Moralis.EvmApi.token.getWalletTokenBalances({
    chain: EvmChain[chain],
    tokenAddresses,
    address,
  });
  return response.raw;
}

export interface MoralisStreamTransactions {
  confirmed: boolean;
  chainId: string;
  abi: any[];
  streamId: string;
  tag: string;
  retries: number;
  block: Block;
  logs: Log[];
  txs: Tx[];
  txsInternal: any[];
  erc20Transfers: Erc20Transfer[];
  erc20Approvals: any[];
  nftTokenApprovals: any[];
  nftApprovals: NftApprovals;
  nftTransfers: any[];
  nativeBalances: any[];
}

export interface Block {
  number: string;
  hash: string;
  timestamp: string;
}

export interface Log {
  logIndex: string;
  transactionHash: string;
  address: string;
  data: string;
  topic0: string;
  topic1: string;
  topic2: string;
  topic3: any;
}

export interface Tx {
  hash: string;
  gas: string;
  gasPrice: string;
  nonce: string;
  input: string;
  transactionIndex: string;
  fromAddress: string;
  toAddress: string;
  value: string;
  type: string;
  v: string;
  r: string;
  s: string;
  receiptCumulativeGasUsed: string;
  receiptGasUsed: string;
  receiptContractAddress: any;
  receiptRoot: any;
  receiptStatus: string;
}

export interface Erc20Transfer {
  transactionHash: string;
  logIndex: string;
  contract: string;
  from: string;
  to: string;
  value: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: string;
  valueWithDecimals: string;
}

export interface NftApprovals {
  ERC721: any[];
  ERC1155: any[];
}
