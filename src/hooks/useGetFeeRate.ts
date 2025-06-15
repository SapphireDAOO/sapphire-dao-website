// import { INVOICE_ADDRESS } from "@/constants";

// import { polygonAmoy } from "wagmi/chains";
// import { useAccount, useChainId, useReadContract } from "wagmi";
// import { paymentProcessor } from "@/abis/PaymentProcessor";

// /**
//  * Custom hook to retrieve the transaction fee from the PaymentProcessor smart contract.
//  *
//  * @returns  - An object containing:
//  *   - `data`: The fee amount retrieved from the smart contract.
//  *   - `refetch`: A function to manually refetch the fee from the contract.
//  *   - `isLoading`: A boolean indicating whether the fee data is still being fetched.
//  */
// export const useGetFeeRate = () => {
//   // Get the connected user's wallet address using the wagmi `useAccount` hook
//   const { address } = useAccount();

//   // Get the current chain ID using the wagmi `useChainId` hook
//   const chainId = useChainId();

//   const { data, refetch, isLoading } = useReadContract({
//     abi: paymentProcessor,
//     chainId: polygonAmoy.id,
//     address: INVOICE_ADDRESS[chainId],
//     functionName: "getFeeRate",
//     account: address,
//   });

//   return { data, refetch, isLoading };
// };
