// import { paymentProcessor } from "@/abis/PaymentProcessor";
// import { INVOICE_ADDRESS } from "@/constants";
// import { polygonAmoy } from "viem/chains";
// import { useAccount, useChainId, useReadContract } from "wagmi";

// /**
//  * Custom hook to retrieve the fee receiver address from the PaymentProcessor smart contract.
//  *
//  * @returns - An object containing:
//  *   - `data`: The fee receiver's address returned by the smart contract.
//  *   - `refetch`: A function to manually refetch the fee receiver address.
//  *   - `isLoading`: A boolean indicating whether the contract data is still being fetched.
//  */
// export const useGetFeeReceiver = () => {
//   // Get the connected user's wallet address using the wagmi `useAccount` hook
//   const { address } = useAccount();

//   // Get the current chain ID using the wagmi `useChainId` hook
//   const chainId = useChainId();

//   // Use the wagmi `useReadContract` hook to interact with the `getFeeReceiver` function of the PaymentProcessor contract
//   const { data, refetch, isLoading } = useReadContract({
//     abi: paymentProcessor,
//     chainId: polygonAmoy.id,
//     address: INVOICE_ADDRESS[chainId],
//     // functionName: "getFeeReceiver",
//     account: address,
//   });

//   return { data, refetch, isLoading };
// };
