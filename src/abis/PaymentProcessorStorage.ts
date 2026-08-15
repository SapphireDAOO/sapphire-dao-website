export const PaymentProcessorStorage = [
  {
    type: "constructor",
    inputs: [
      {
        name: "_configuration",
        type: "tuple",
        internalType: "struct IPaymentProcessorStorage.Configuration",
        components: [
          { name: "owner", type: "address", internalType: "address" },
          { name: "feeRate", type: "uint96", internalType: "uint96" },
          {
            name: "feeReceiver",
            type: "address",
            internalType: "address",
          },
          {
            name: "defaultHoldPeriod",
            type: "uint96",
            internalType: "uint96",
          },
          {
            name: "marketplace",
            type: "address",
            internalType: "address",
          },
          {
            name: "gasThreshold",
            type: "uint96",
            internalType: "uint96",
          },
        ],
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "BASIS_POINTS",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "DEFAULT_PAYMENT_VALIDITY_PERIOD",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "EMERGENCY_PAUSE_DURATION",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approveEmergencyPause",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "cancelOwnershipHandover",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "completeOwnershipHandover",
    inputs: [
      { name: "pendingOwner", type: "address", internalType: "address" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "emergencyPause",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getDefaultHoldPeriod",
    inputs: [],
    outputs: [
      {
        name: "defaultHoldPeriod",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getEmergencyPauseExpiry",
    inputs: [],
    outputs: [{ name: "expiry", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getEmergencyPauser",
    inputs: [],
    outputs: [
      {
        name: "emergencyPauserAddress",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getFeeRate",
    inputs: [],
    outputs: [{ name: "feeRate", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getFeeReceiver",
    inputs: [],
    outputs: [
      { name: "feeReceiver", type: "address", internalType: "address" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getGasThreshold",
    inputs: [],
    outputs: [
      { name: "gasThreshold", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMarketplace",
    inputs: [],
    outputs: [
      { name: "marketplace", type: "address", internalType: "address" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getNextInvoiceNonce",
    inputs: [],
    outputs: [
      {
        name: "nextInvoiceNonceValue",
        type: "uint216",
        internalType: "uint216",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPaymentValidityDuration",
    inputs: [],
    outputs: [
      {
        name: "validDuration",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isPaused",
    inputs: [],
    outputs: [{ name: "pausedState", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "result", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ownershipHandoverExpiresAt",
    inputs: [
      { name: "pendingOwner", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "result", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "pause",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "renounceOwnership",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "requestOwnershipHandover",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "setDefaultHoldPeriod",
    inputs: [
      {
        name: "_newDefaultHoldPeriod",
        type: "uint96",
        internalType: "uint96",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setEmergencyPauser",
    inputs: [
      {
        name: "_emergencyPauser",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setFeeRate",
    inputs: [{ name: "_newFeeRate", type: "uint96", internalType: "uint96" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setFeeReceiver",
    inputs: [
      {
        name: "_feeReceiverAddress",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setGasThreshold",
    inputs: [
      {
        name: "_newGasThreshold",
        type: "uint96",
        internalType: "uint96",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setMarketplaceAddress",
    inputs: [
      {
        name: "_marketplaceAddress",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setPaymentValidityDuration",
    inputs: [
      {
        name: "_newValidityDuration",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "totalInvoiceCreated",
    inputs: [],
    outputs: [
      {
        name: "totalInvoices",
        type: "uint216",
        internalType: "uint216",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "transferOwnership",
    inputs: [{ name: "newOwner", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "unpause",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updateInvoiceNonce",
    inputs: [{ name: "_by", type: "uint216", internalType: "uint216" }],
    outputs: [
      {
        name: "totalInvoices",
        type: "uint216",
        internalType: "uint216",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "AuthorizationUpdated",
    inputs: [
      {
        name: "account",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "authorized",
        type: "bool",
        indexed: false,
        internalType: "bool",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ConfigurationInitialized",
    inputs: [
      {
        name: "config",
        type: "tuple",
        indexed: false,
        internalType: "struct IPaymentProcessorStorage.Configuration",
        components: [
          { name: "owner", type: "address", internalType: "address" },
          { name: "feeRate", type: "uint96", internalType: "uint96" },
          {
            name: "feeReceiver",
            type: "address",
            internalType: "address",
          },
          {
            name: "defaultHoldPeriod",
            type: "uint96",
            internalType: "uint96",
          },
          {
            name: "marketplace",
            type: "address",
            internalType: "address",
          },
          {
            name: "gasThreshold",
            type: "uint96",
            internalType: "uint96",
          },
        ],
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "DefaultHoldPeriodUpdated",
    inputs: [
      {
        name: "defaultHoldPeriod",
        type: "uint96",
        indexed: false,
        internalType: "uint96",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "EmergencyPauseApproved",
    inputs: [
      {
        name: "account",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "EmergencyPaused",
    inputs: [
      {
        name: "account",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "expiry",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "EmergencyPauserUpdated",
    inputs: [
      {
        name: "emergencyPauser",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "FeeRateUpdated",
    inputs: [
      {
        name: "feeRate",
        type: "uint96",
        indexed: false,
        internalType: "uint96",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "FeeReceiverUpdated",
    inputs: [
      {
        name: "feeReceiver",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "GasThresholdUpdated",
    inputs: [
      {
        name: "gasThreshold",
        type: "uint96",
        indexed: false,
        internalType: "uint96",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "MarketplaceUpdated",
    inputs: [
      {
        name: "marketplace",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OwnershipHandoverCanceled",
    inputs: [
      {
        name: "pendingOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OwnershipHandoverRequested",
    inputs: [
      {
        name: "pendingOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OwnershipTransferred",
    inputs: [
      {
        name: "oldOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "newOwner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Paused",
    inputs: [
      {
        name: "account",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "PaymentValidityDurationUpdated",
    inputs: [
      {
        name: "validityDuration",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Unpaused",
    inputs: [
      {
        name: "account",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  { type: "error", name: "AlreadyInitialized", inputs: [] },
  { type: "error", name: "AlreadyPaused", inputs: [] },
  { type: "error", name: "HoldPeriodCanNotBeZero", inputs: [] },
  { type: "error", name: "InvalidFeeRate", inputs: [] },
  { type: "error", name: "NewOwnerIsZeroAddress", inputs: [] },
  { type: "error", name: "NoActiveEmergencyPause", inputs: [] },
  { type: "error", name: "NoHandoverRequest", inputs: [] },
  { type: "error", name: "NotAuthorized", inputs: [] },
  { type: "error", name: "NotPaused", inputs: [] },
  { type: "error", name: "Unauthorized", inputs: [] },
] as const;
