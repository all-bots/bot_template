import { Erc20__factory, SellToken__factory } from "../types/ethers";
import { getProvider, getProviderByChain } from "./providers";

export const provider = getProvider();

export function getErc20Contract(address: string, signer?: any) {
  // const provider = getProvider()
  return Erc20__factory.connect(address, signer || getProvider());
}

export function getErc20ContractByChain(
  address: string,
  rpc_urls: string[],
  signer?: any,
) {
  // const provider = getProviderByChain(rpc_urls)
  return Erc20__factory.connect(
    address,
    signer || getProviderByChain(rpc_urls),
  );
}

export function getSellContract(address: string, signer?: any) {
  return SellToken__factory.connect(address, signer || getProvider());
}
