import { ETHEREUM_SEPOLIA, PAYMENT_PROCESSOR_STORAGE } from "@/constants";
import { sepolia } from "viem/chains";
import { useAccount, useChainId } from "wagmi";
import { Address, formatEther } from "viem";
import { PaymentProcessorStorage } from "@/abis/PaymentProcessorStorage";
import { useViemReadContract } from "./useViemReadContract";
import { useViemBalance } from "./useViemBalance";

/**
 * Custom hook to retrieve the balance of POL in the marketplace wallet.
 *
 * @returns {string | undefined} return.data - The POL balance formatted in ether, or undefined if not available.
 * @returns {Function} return.refetch - Function to refetch the balance and marketplace address.
 * @returns {boolean} return.isLoading - Indicates if the balance or marketplace address is being fetched.
 */
export const useGetBalance = () => {
  // Retrieve the current user's wallet address using the wagmi `useAccount` hook
  const { address } = useAccount();

  // Retrieve the current chain ID using the wagmi `useChainId` hook
  const chainId = useChainId() || ETHEREUM_SEPOLIA;

  // Fetch the marketplace address from the AdvancedPaymentProcessor contract
  const {
    data: marketplaceAddress,
    isLoading: isLoadingAddress,
    refetch: refetchAddress,
  } = useViemReadContract({
    abi: PaymentProcessorStorage,
    chainId: sepolia.id,
    address: PAYMENT_PROCESSOR_STORAGE[chainId],
    functionName: "getMarketplace",
    account: address,
  });

  // Fetch the POL balance of the marketplace address
  const {
    data: balanceData,
    isLoading: isLoadingBalance,
    refetch: refetchBalance,
  } = useViemBalance({
    address: marketplaceAddress as Address | undefined,
    chainId: sepolia.id,
  });

  // Format the balance in ether (from wei)
  const formattedBalance = balanceData ? formatEther(balanceData) : undefined;

  // Combine refetch functions
  const refetch = async () => {
    await Promise.all([refetchAddress(), refetchBalance()]);
  };

  return {
    data: formattedBalance,
    refetch,
    isLoading: isLoadingAddress || isLoadingBalance,
  };
};
