"use client";

import { useState, useEffect } from "react";
import { TokenData } from "@/model/model";
import { client } from "@/services/graphql/client";
import { paymentTokenQuery } from "@/services/graphql/queries";
import { useChainId } from "wagmi";
import { BASE_SEPOLIA, getKnownPaymentToken } from "@/constants";

const DEFAULT_TOKEN: TokenData = {
  name: "",
  id: "",
  decimals: 18,
};

const tokenCache = new Map<string, TokenData>();
const inflightRequests = new Map<string, Promise<TokenData>>();

export const useGetPaymentTokenData = (tokenId: string) => {
  const chainId = useChainId() || BASE_SEPOLIA;
  const normalizedTokenId = tokenId?.toLowerCase();
  const cacheKey = `${chainId}:${normalizedTokenId}`;
  const [token, setToken] = useState<TokenData>(() => {
    return (
      tokenCache.get(cacheKey) ??
      getKnownPaymentToken(chainId, normalizedTokenId) ??
      DEFAULT_TOKEN
    );
  });

  useEffect(() => {
    let canceled = false;

    const fetchToken = async () => {
      if (!normalizedTokenId) {
        setToken(DEFAULT_TOKEN);
        return;
      }

      const cached = tokenCache.get(cacheKey);
      if (cached) {
        setToken(cached);
        return;
      }

      const knownToken = getKnownPaymentToken(chainId, normalizedTokenId);
      if (knownToken) {
        tokenCache.set(cacheKey, knownToken);
        setToken(knownToken);
        return;
      }

      let request = inflightRequests.get(cacheKey);

      if (!request) {
        request = client(chainId)
          .query(paymentTokenQuery, { id: normalizedTokenId })
          .toPromise()
          .then(({ data, error }) => {
            if (error) {
              console.error("GraphQL error:", error);
              return DEFAULT_TOKEN;
            }

            if (!data?.paymentToken) return DEFAULT_TOKEN;

            return {
              name: data.paymentToken.name,
              id: data.paymentToken.id,
              decimals: Number(data.paymentToken.decimal ?? 18),
            } as TokenData;
          })
          .finally(() => {
            inflightRequests.delete(cacheKey);
          });

        inflightRequests.set(cacheKey, request);
      }

      const resolved = await request;
      if (canceled) return;

      if (resolved.id) {
        tokenCache.set(cacheKey, resolved);
      }
      setToken(resolved.id ? resolved : DEFAULT_TOKEN);
    };

    void fetchToken();

    return () => {
      canceled = true;
    };
  }, [cacheKey, chainId, normalizedTokenId]);

  return token;
};
