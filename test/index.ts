import { expect } from "chai";
import { ethers } from "hardhat";

describe("Flip", function () {
  // it("Should get games after open games", async function () {
  //   const [owner, addr1] = await ethers.getSigners();

  //   const Flip = await ethers.getContractFactory("Flip");
  //   const flip = await Flip.deploy();
  //   await flip.deployed();
  //   await flip.openGame(5);
  //   await flip.connect(addr1).openGame(10);

  //   const result = await flip.getGames();
  //   // console.log(result);
  //   expect(result.length).to.equal(2);
  //   expect(result[0].initiator).to.equal(owner.address);
  //   expect(result[0].amount).to.equal(5);
  //   expect(result[1].initiator).to.equal(addr1.address);
  //   expect(result[1].amount).to.equal(10);
  // });

  it("Check balance status", async function () {
    // const [owner, addr1] = await ethers.getSigners();

    const Flip = await ethers.getContractFactory("Flip");
    const flip = await Flip.deploy(
      "0x557e211EC5fc9a6737d2C6b7a1aDe3e0C11A8D5D"
    );
    await flip.deployed();
    const balance = await ethers.provider.getBalance(flip.address);
    expect(balance).to.equal(0);

    // await flip.openGameWithEth(5);
    // await flip.connect(addr1).openGame(10);

    // const result = await flip.getGames();
    // expect(result.length).to.equal(2);
    // expect(result[0].initiator).to.equal(owner.address);
    // expect(result[0].amount).to.equal(5);
    // expect(result[1].initiator).to.equal(addr1.address);
    // expect(result[1].amount).to.equal(10);
  });
});
