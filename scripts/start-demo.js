const { spawn } = require("node:child_process");
const { once } = require("node:events");
const fs = require("node:fs/promises");
const path = require("node:path");
const hre = require("hardhat");
const { ethers } = require("ethers");

const rpcUrl = "http://127.0.0.1:8545";
const projectRoot = path.resolve(__dirname, "..");
let chainProcess;
let viteProcess;
let stopping = false;

function start(command, args, label, options = {}) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    ...options,
  });
  child.on("error", (error) => {
    console.error(`${label} failed to start: ${error.message}`);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) {
      console.error(`${label} stopped${code === null ? "" : ` with code ${code}`}.`);
      stop(code || 1);
    }
  });
  return child;
}

async function waitForChain() {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await provider.getBlockNumber();
      return provider;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error("Hardhat node did not become ready at http://127.0.0.1:8545.");
}

async function deployDemo(provider) {
  await hre.run("compile");
  const creator = await provider.getSigner(0);
  const backerOne = await provider.getSigner(1);
  const backerTwo = await provider.getSigner(2);
  const factory = await hre.ethers.getContractFactory("CrowdfundingPlatform", creator);
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const goal = ethers.parseEther("10");
  const create = await contract.createCampaign(
    "Solar for the Neighborhood",
    "A community solar project making clean energy more accessible.",
    goal,
    30,
    ["Install the solar panels", "Power the community center"],
    [ethers.parseEther("5"), ethers.parseEther("5")],
  );
  await create.wait();
  await (await contract.connect(backerOne).acceptCampaign(1)).wait();
  await (await contract.connect(backerTwo).acceptCampaign(1)).wait();
  await (await contract.connect(backerOne).contribute(1, { value: ethers.parseEther("6") })).wait();
  await (await contract.connect(backerTwo).contribute(1, { value: ethers.parseEther("4") })).wait();
  await (await contract.submitMilestoneProof(1, "QmSolarInstallationProof")).wait();

  const address = await contract.getAddress();
  const adminAddress = await creator.getAddress();
  await fs.writeFile(
    path.join(projectRoot, ".env.local"),
    `VITE_CONTRACT_ADDRESS=${address}\nVITE_ADMIN_ADDRESS=${adminAddress}\n`,
    "utf8",
  );
  console.log(`\nDemo contract deployed at ${address}`);
  console.log(`Demo admin wallet: ${adminAddress}`);
  console.log("Seeded campaign: Solar for the Neighborhood · 10 ETH raised · milestone vote open");
}

async function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of [viteProcess, chainProcess]) {
    if (child && child.exitCode === null) child.kill("SIGTERM");
  }
  process.exitCode = exitCode;
}

async function main() {
  chainProcess = start(
    process.execPath,
    [path.join(projectRoot, "node_modules", "hardhat", "internal", "cli", "bootstrap.js"), "node", "--hostname", "127.0.0.1"],
    "Hardhat node",
  );
  const provider = await waitForChain();
  await deployDemo(provider);

  viteProcess = start(
    process.execPath,
    [path.join(projectRoot, "node_modules", "vite", "bin", "vite.js"), "--host", "127.0.0.1"],
    "Vite",
  );
  await once(viteProcess, "spawn");
  console.log("Press Ctrl+C to stop the app and local blockchain.\n");
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

main().catch((error) => {
  console.error(error);
  stop(1);
});
