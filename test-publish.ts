import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const PRICE_ORACLE_ADDRESS = process.env.VITE_PRICE_ORACLE_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = process.env.FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc";

// ABI for PriceOracle
const PriceOracleABI = [
  "function setPrediction(uint256 predictedPrice, uint256 confidence, uint256 expiresAt, string calldata metadata) external",
  "function getLatestPrediction() external view returns (uint256 price, uint256 confidence, uint256 expiresAt, string memory metadata)"
];

async function main() {
  if (!PRIVATE_KEY) {
    console.error("No private key found");
    return;
  }
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const oracleContract = new ethers.Contract(PRICE_ORACLE_ADDRESS!, PriceOracleABI, wallet);

  console.log("Wallet address:", wallet.address);
  console.log("Oracle address:", PRICE_ORACLE_ADDRESS);

  const price = ethers.parseUnits("35.50", 18);
  const confidence = 85;
  const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
  const metadata = JSON.stringify({ source: "AI_System_Test" });

  try {
    console.log("Publishing prediction...");
    const tx = await oracleContract.setPrediction(price, confidence, expiresAt, metadata);
    console.log("Tx hash:", tx.hash);
    await tx.wait();
    console.log("✅ Successfully published AI prediction!");
    
    const latest = await oracleContract.getLatestPrediction();
    console.log("Latest prediction:", latest);
  } catch (error) {
    console.error("❌ Failed to publish prediction:", error);
  }
}

main().catch(console.error);
