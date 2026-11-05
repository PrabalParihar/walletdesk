export type Deployment = {
  network: string;
  chainId: number;
  rpcUrl: string;
  keeperUrl: string;
  aqua: `0x${string}`;
  poolManager: `0x${string}`;
  swapVm: `0x${string}`;
  hook: `0x${string}`;
  overflowRouter: `0x${string}`;
  orderBuilder: `0x${string}`;
  token0: `0x${string}`;
  token1: `0x${string}`;
  symbol0: string;
  symbol1: string;
  fee: number;
  tickSpacing: number;
  treasury: `0x${string}`;
  usdc: `0x${string}`;
  maker: `0x${string}`;
  taker: `0x${string}`;
  deployBlock: number;
  poolId: `0x${string}`;
  poolCap: string;
  shipAmount: string;
  exampleSwap: string;
  strategyHash: `0x${string}`;
  settlement: string;
  arcChainId?: number;
  arcTreasury?: `0x${string}`;
  explorer?: string;
};

export function poolKey(deployment: Deployment) {
  return {
    currency0: deployment.token0,
    currency1: deployment.token1,
    fee: deployment.fee,
    tickSpacing: deployment.tickSpacing,
    hooks: deployment.hook,
  } as const;
}

export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
] as const;

export const aquaAbi = [
  {
    type: "function",
    name: "ship",
    stateMutability: "nonpayable",
    inputs: [
      { name: "app", type: "address" },
      { name: "strategy", type: "bytes" },
      { name: "tokens", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    outputs: [{ name: "strategyHash", type: "bytes32" }],
  },
  {
    type: "function",
    name: "safeBalances",
    stateMutability: "view",
    inputs: [
      { name: "maker", type: "address" },
      { name: "app", type: "address" },
      { name: "strategyHash", type: "bytes32" },
      { name: "token0", type: "address" },
      { name: "token1", type: "address" },
    ],
    outputs: [
      { type: "uint256" },
      { type: "uint256" },
    ],
  },
] as const;

export const builderAbi = [
  {
    type: "function",
    name: "buildBand",
    stateMutability: "pure",
    inputs: [
      { name: "maker", type: "address" },
      { name: "priceLowX18", type: "uint256" },
      { name: "priceHighX18", type: "uint256" },
      { name: "feeBps", type: "uint16" },
      { name: "start", type: "uint32" },
      { name: "halfLife", type: "uint32" },
    ],
    outputs: [
      { name: "traits", type: "uint256" },
      { name: "data", type: "bytes" },
      { name: "strategy", type: "bytes" },
    ],
  },
] as const;

const poolComponents = [
  { name: "currency0", type: "address" },
  { name: "currency1", type: "address" },
  { name: "fee", type: "uint24" },
  { name: "tickSpacing", type: "int24" },
  { name: "hooks", type: "address" },
] as const;

const orderComponents = [
  { name: "maker", type: "address" },
  { name: "traits", type: "uint256" },
  { name: "data", type: "bytes" },
] as const;

export const hookAbi = [
  {
    type: "function",
    name: "registerDesk",
    stateMutability: "nonpayable",
    inputs: [
      { name: "key", type: "tuple", components: poolComponents },
      { name: "order", type: "tuple", components: orderComponents },
      { name: "inputCap", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "lastFill",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [
      { name: "maker", type: "address" },
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "residualIn", type: "uint256" },
      { name: "filledOut", type: "uint256" },
      { name: "feeOut", type: "uint256" },
      { name: "fillId", type: "bytes32" },
    ],
  },
  {
    type: "function",
    name: "strategyHash",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "poolInputCap",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const routerAbi = [
  {
    type: "function",
    name: "swapExactInput",
    stateMutability: "nonpayable",
    inputs: [
      { name: "key", type: "tuple", components: poolComponents },
      { name: "zeroForOne", type: "bool" },
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "recipient", type: "address" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

export const treasuryAbi = [
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "claimable",
    stateMutability: "view",
    inputs: [{ name: "maker", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "protocolBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint16" }],
  },
  {
    type: "function",
    name: "protocol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "fillCredited",
    stateMutability: "view",
    inputs: [{ name: "fillId", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
] as const;

export function shortError(error: unknown): string {
  if (error && typeof error === "object" && "shortMessage" in error) {
    return String((error as { shortMessage: unknown }).shortMessage);
  }
  if (error instanceof Error) return error.message.slice(0, 320);
  return String(error).slice(0, 320);
}

export function parseDeployment(raw: unknown): Deployment {
  if (!raw || typeof raw !== "object") throw new Error("Deployment file is empty.");
  const value = raw as Record<string, unknown>;
  const address = (key: string) => {
    const item = value[key];
    if (typeof item !== "string" || !item.startsWith("0x")) throw new Error(`${key} is missing from the deployment file.`);
    return item as `0x${string}`;
  };
  const text = (key: string) => {
    const item = value[key];
    if (typeof item !== "string" || item.length === 0) throw new Error(`${key} is missing from the deployment file.`);
    return item;
  };
  const num = (key: string) => {
    const item = value[key];
    if (typeof item !== "number") throw new Error(`${key} is missing from the deployment file.`);
    return item;
  };
  return {
    network: text("network"),
    chainId: num("chainId"),
    rpcUrl: text("rpcUrl"),
    keeperUrl: text("keeperUrl"),
    aqua: address("aqua"),
    poolManager: address("poolManager"),
    swapVm: address("swapVm"),
    hook: address("hook"),
    overflowRouter: address("overflowRouter"),
    orderBuilder: address("orderBuilder"),
    token0: address("token0"),
    token1: address("token1"),
    symbol0: text("symbol0"),
    symbol1: text("symbol1"),
    fee: num("fee"),
    tickSpacing: num("tickSpacing"),
    treasury: address("treasury"),
    usdc: address("usdc"),
    maker: address("maker"),
    taker: address("taker"),
    deployBlock: num("deployBlock"),
    poolId: address("poolId"),
    poolCap: text("poolCap"),
    shipAmount: text("shipAmount"),
    exampleSwap: text("exampleSwap"),
    strategyHash: address("strategyHash"),
    settlement: text("settlement"),
    arcChainId: typeof value.arcChainId === "number" ? value.arcChainId : undefined,
    arcTreasury: typeof value.arcTreasury === "string" && value.arcTreasury.startsWith("0x")
      ? (value.arcTreasury as `0x${string}`)
      : undefined,
    explorer: typeof value.explorer === "string" ? value.explorer : undefined,
  };
}
