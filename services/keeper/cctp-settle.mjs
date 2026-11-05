/**
 * Settle one maker fee from Unichain Sepolia to Arc testnet with CCTP V2.
 *
 * This does not run in the local demo. Iris will not attest a burn that exists
 * only on an anvil fork. See docs/CCTP.md.
 *
 * Required env (never commit the values):
 *   SOURCE_RPC, ARC_RPC, SOURCE_PRIVATE_KEY, ARC_PRIVATE_KEY,
 *   BRIDGE, TREASURY, USDC, FILL_ID, MAKER, AMOUNT
 * Optional: BURN_TX (skip the burn if you already sent one), MAX_FEE, FINALITY
 */
import { createPublicClient, createWalletClient, http, pad, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { isLoopbackRpc } from "./scale.mjs";

const sourceRpc = required("SOURCE_RPC");
const arcRpc = required("ARC_RPC");
if (isLoopbackRpc(sourceRpc) || isLoopbackRpc(arcRpc)) {
  console.error("CCTP settlement refuses loopback RPCs. Anvil state is not attested by Iris.");
  process.exit(1);
}

const sourceAccount = privateKeyToAccount(required("SOURCE_PRIVATE_KEY"));
const arcAccount = privateKeyToAccount(required("ARC_PRIVATE_KEY"));
const bridge = required("BRIDGE");
const treasury = required("TREASURY");
const usdc = required("USDC");
const fillId = required("FILL_ID");
const maker = required("MAKER");
const amount = BigInt(required("AMOUNT"));
const maxFee = BigInt(process.env.MAX_FEE || "0");
const finality = Number(process.env.FINALITY || "2000");

const bridgeAbi = parseAbi([
  "function bridgeFee(bytes32 fillId, address maker, uint256 amount, bytes32 mintRecipient, uint256 maxFee, uint32 minFinalityThreshold)",
]);
const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);
const transmitterAbi = parseAbi([
  "function receiveMessage(bytes message, bytes attestation) returns (bool)",
]);
const treasuryAbi = parseAbi([
  "function creditFromFill(bytes32 fillId, address maker, uint256 amount)",
  "function fillCredited(bytes32) view returns (bool)",
]);

const source = createPublicClient({ transport: http(sourceRpc) });
const sourceWallet = createWalletClient({ account: sourceAccount, transport: http(sourceRpc) });
const arc = createPublicClient({ transport: http(arcRpc) });
const arcWallet = createWalletClient({ account: arcAccount, transport: http(arcRpc) });

let burnTx = process.env.BURN_TX;
if (!burnTx) {
  const allowance = await source.readContract({
    address: usdc,
    abi: erc20Abi,
    functionName: "allowance",
    args: [sourceAccount.address, bridge],
  });
  if (allowance < amount) {
    const approveHash = await sourceWallet.writeContract({
      address: usdc,
      abi: erc20Abi,
      functionName: "approve",
      args: [bridge, amount],
    });
    await source.waitForTransactionReceipt({ hash: approveHash });
  }
  burnTx = await sourceWallet.writeContract({
    address: bridge,
    abi: bridgeAbi,
    functionName: "bridgeFee",
    args: [fillId, maker, amount, pad(treasury), maxFee, finality],
  });
  console.log("burn", burnTx);
  await source.waitForTransactionReceipt({ hash: burnTx });
}

const attestation = await pollIris(10, burnTx);
console.log("iris status", attestation.status);
const mintHash = await arcWallet.writeContract({
  address: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
  abi: transmitterAbi,
  functionName: "receiveMessage",
  args: [attestation.message, attestation.attestation],
  gas: 600_000n,
});
console.log("mint", mintHash);
await arc.waitForTransactionReceipt({ hash: mintHash });

const credited = await arc.readContract({
  address: treasury,
  abi: treasuryAbi,
  functionName: "fillCredited",
  args: [fillId],
});
if (!credited) {
  const creditHash = await arcWallet.writeContract({
    address: treasury,
    abi: treasuryAbi,
    functionName: "creditFromFill",
    args: [fillId, maker, amount],
    gas: 400_000n,
  });
  console.log("credit", creditHash);
  await arc.waitForTransactionReceipt({ hash: creditHash });
}
console.log("settled", fillId);

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`missing ${name}`);
    process.exit(1);
  }
  return value;
}

async function pollIris(domain, txHash) {
  const url = `https://iris-api-sandbox.circle.com/v2/messages/${domain}?transactionHash=${txHash}`;
  for (let attempt = 0; attempt < 60; attempt++) {
    const response = await fetch(url);
    if (response.ok) {
      const body = await response.json();
      const message = body.messages?.find((item) => item.attestation && item.attestation !== "PENDING");
      if (message?.message && message.attestation) return message;
      console.log("waiting for iris", body.messages?.[0]?.status || response.status);
    } else {
      console.log("iris", response.status);
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  throw new Error("Iris did not attest the burn in time. https://developers.circle.com/cctp/references/iris-api");
}
