"use client";

import { useState, useEffect } from "react";
import { TokenData } from "@/model/model";
import { client } from "@/services/graphql/client";
import { paymentTokenQuery } from "@/services/graphql/queries";
import { useChainId } from "wagmi";
import { ETHEREUM_SEPOLIA } from "@/constants";

export const useGetPaymentTokenData = (tokenId: string) => {
  const chainId = useChainId() || ETHEREUM_SEPOLIA;
  const [token, setToken] = useState<TokenData>({
    name: "",
    id: "",
    decimals: 18,
  });

  useEffect(() => {
    const fetchToken = async () => {
      if (!tokenId) return;

      const { data, error } = await client(chainId)
        .query(paymentTokenQuery, { id: tokenId })
        .toPromise();

      if (error) {
        console.error("GraphQL error:", error);
        return;
      }

      if (data?.paymentToken) {
        setToken({
          name: data.paymentToken.name,
          id: data.paymentToken.id,
          decimals: data.paymentToken.decimal,
        });
      }
    };

    fetchToken();
  }, [tokenId, chainId]);

  return token;
};
