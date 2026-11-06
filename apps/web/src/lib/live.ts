import type { Deployment } from "@/lib/contracts";

/** Public repository. Links resolve once the repository is public. */
export const REPO_URL = "https://github.com/PrabalParihar/walletdesk";
export const repoFile = (path: string, line?: number) => `${REPO_URL}/blob/main/${path}${line ? `#L${line}` : ""}`;

export const SEPOLIA_EXPLORER = "https://sepolia.uniscan.xyz";

/**
 * The live WalletDesk deployment on Unichain Sepolia (docs/DEPLOYMENTS.md). Used as the default network, so the app
 * shows real on-chain state with no local chain and no environment variables. Env vars still override it.
 */
export const SEPOLIA_DEPLOYMENT: Deployment = {
  network: "sepolia",
  chainId: 1301,
  rpcUrl: "https://sepolia.unichain.org",
  keeperUrl: "",
  aqua: "0x8D9436f8c5bCA114E1C57647505b4C46e03F0D07",
  poolManager: "0x00B036B58a818B1BC34d502D3fE730Db729e62AC",
  swapVm: "0x4a4a0Ac5C8B4d9745870549800200d8b4Bd86757",
  hook: "0x9b647cD39D9909FFE56449507058D16F9bBb4088",
  overflowRouter: "0xAAA2319f9BcB7e3B6291F9a992931214FC6bFB70",
  stockRouter: "0x3e9ad0416aA458A1c58C989f6D6Eb40D216Bb284",
  priceFeed: "0xb1749dDDd701D99a9f318610a7A6962b11409c82",
  orderBuilder: "0x89325CFc9f1509aa11c3399a9d00848b561C099a",
  token0: "0x6b5D58110388AbaFD92Aa28CdD6Bb81cb6dDeE90",
  token1: "0xc68102a658c0c39625b9b7F8e500eea07a934f31",
  symbol0: "DA",
  symbol1: "DB",
  decimals0: 18,
  decimals1: 18,
  fee: 3000,
  tickSpacing: 60,
  maxDeviationBps: 100,
  maker: "0xdC8415C8A712cDdD6Bf503d45b54DB29A1a4e759",
  taker: "0xdC8415C8A712cDdD6Bf503d45b54DB29A1a4e759",
  deployBlock: 0,
  poolId: "0xae93c1bd88e46a2fae33d97774b45f23f4b50d09592456487f208e1314bda1fe",
  poolCap: "1000000000000000000",
  shipAmount: "1000000000000000000000",
  exampleSwap: "5000000000000000000",
  // The seeded maker's DeskBand strategy (SeedLive). Lets the live page show Aqua's virtual shelf.
  strategyHash: "0xef84879c6183c3406aa7b779c3f16a8933c0e50224eb6bae9fc630508fc08da4",
  settlement: "none",
  explorer: SEPOLIA_EXPLORER,
};

/** Key transactions from the live Sepolia run, verified against the public chain (docs/DEPLOYMENTS.md). */
export const SEPOLIA_PROOF = {
  ship: "0x495fb08365fc9bc96679c21cfb056506d8b41c525e910c07a7f0031f02824378",
  register: "0x780c3ddbe89eee9ae751b617ed925f8d85219cac330b7a4c0f3c2aa5af3c91b1",
  reference: "0xfecb972a665dcb1d6ddbaf6bda19a890db51a890f52b273dcafa389d96e51909",
  overflowRouterFill: "0x0c169e96abd27278b2330755717034dc30bc5d7eed5be48dbc48dbc43bff0340",
  stockRouterFill: "0x8d2b81fe61e8d7f5ea1187e32b6d8ad81904df3b3de595556a7809286f305d6e",
} as const;

export const txUrl = (explorer: string | undefined, hash: string) => (explorer ? `${explorer}/tx/${hash}` : undefined);
export const addressUrl = (explorer: string | undefined, address: string) =>
  explorer ? `${explorer}/address/${address}` : undefined;
