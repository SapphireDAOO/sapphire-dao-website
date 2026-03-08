"use client";
import React, { useState } from "react";

type Props = {
  fullValue: string;
};

const CopyableAddress = ({ fullValue }: Props) => {
  const shortValue = `${fullValue.slice(0, 6)}...${fullValue.slice(-4)}`;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  return (
    <div
      className="text-center font-mono cursor-pointer hover:underline"
      title="Click to copy"
      onClick={handleCopy}
    >
      {copied ? "Copied!" : shortValue}
    </div>
  );
};

export default CopyableAddress;
