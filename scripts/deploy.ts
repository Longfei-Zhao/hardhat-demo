import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const Flip = await ethers.getContractFactory("Flip");
  const flip = await Flip.deploy("0x557e211EC5fc9a6737d2C6b7a1aDe3e0C11A8D5D");

  console.log("Token address:", flip.address);
}

main().catch((error) => {
  console.error(error);
});
