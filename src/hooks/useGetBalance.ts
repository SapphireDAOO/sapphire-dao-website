import { ADVANCE_INVOICE_ADDRESS } from "@/constants";
import { polygonAmoy } from "wagmi/chains";
import { useAccount, useChainId, useReadContract, useBalance } from "wagmi";
import { advancedPaymentProcessor } from "@/abis/AdvancedPaymentProcessor";
import { formatEther } from "ethers";

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
  const chainId = useChainId();

  // Fetch the marketplace address from the AdvancedPaymentProcessor contract
  const {
    data: marketplaceAddress,
    isLoading: isLoadingAddress,
    refetch: refetchAddress,
  } = useReadContract({
    abi: advancedPaymentProcessor,
    chainId: polygonAmoy.id,
    address: ADVANCE_INVOICE_ADDRESS[chainId],
    functionName: "getMarketplace",
    account: address,
  });

  // Fetch the POL balance of the marketplace address
  const {
    data: balanceData,
    isLoading: isLoadingBalance,
    refetch: refetchBalance,
  } = useBalance({
    address: marketplaceAddress,
    chainId: polygonAmoy.id,
  });

  // Format the balance in ether (from wei)
  const formattedBalance = balanceData
    ? formatEther(balanceData.value)
    : undefined;

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
