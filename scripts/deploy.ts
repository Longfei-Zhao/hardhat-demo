import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const Flip = await ethers.getContractFactory("Flip");
  const flip = await Flip.deploy();

  console.log("Token address:", flip.address);
}

main().catch((error) => {
  console.error(error);
});
