import { BrowserProvider, JsonRpcSigner } from "ethers";
import { useMemo } from "react";
import type { Account, Chain, Client, Transport } from "viem";
import { type Config, useConnectorClient } from "wagmi";

/**
 * Converts a viem Wallet Client to an ethers.js JsonRpcSigner.
 *
 * @param {Client<Transport, Chain, Account>} client - The viem client object containing account, chain, and transport details.
 * @returns {JsonRpcSigner} - An ethers.js JsonRpcSigner object for interacting with the blockchain.
 */
export function clientToSigner(
  client: Client<Transport, Chain, Account>
): JsonRpcSigner {
  const { account, chain, transport } = client;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };

  // Create a BrowserProvider for ethers.js using the transport and network information
  const provider = new BrowserProvider(transport, network);

  // Create a JsonRpcSigner using the provider and the account address
  const signer = new JsonRpcSigner(provider, account.address);
  return signer;
}

/**
 * React Hook to convert a viem Wallet Client into an ethers.js Signer.
 *
 * @param {Object} options - Options for the hook.
 * @param {number} [options.chainId] - Optional chain ID to specify the blockchain network.
 * @returns {JsonRpcSigner | undefined} - Returns an ethers.js JsonRpcSigner or undefined if the client is not available.
 */
export function useEthersSigner({ chainId }: { chainId?: number } = {}):
  | JsonRpcSigner
  | undefined {
  const { data: client } = useConnectorClient<Config>({ chainId });
  return useMemo(() => (client ? clientToSigner(client) : undefined), [client]);
}
