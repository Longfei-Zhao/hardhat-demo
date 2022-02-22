//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract Flip {
  struct Game {
    address initiator;
    uint256 amount;
  }

  Game[] private games;

  event Result(bool result);

  constructor() {}

  function openGame() public payable {
    games.push(Game({ initiator: msg.sender, amount: msg.value }));
  }

  function acceptGame(uint256 _id) public payable {
    bool result = uint256(
      keccak256(abi.encodePacked(block.difficulty, block.timestamp))
    ) %
      2 ==
      0;
    address payable winner;
    if (result) {
      winner = payable(msg.sender);
    } else {
      winner = payable(games[_id].initiator);
    }
    winner.transfer(games[_id].amount * 2);
    emit Result(result);
    games[_id] = games[games.length - 1];
    games.pop();
  }

  function getGames() public view returns (Game[] memory) {
    return games;
  }
}
