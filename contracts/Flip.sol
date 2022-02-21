//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract Flip {
    struct Game {
        address initiator;
        uint256 amount;
    }

    Game[] private games;

    event Result(bool res);

    constructor() {}

    function getGame(uint256 _id) public view returns (Game memory) {
        return games[_id];
    }

    function getGames() public view returns (Game[] memory) {
        return games;
    }

    function openGame(uint256 _amount) public {
        games.push(Game({initiator: msg.sender, amount: _amount}));
    }

    function acceptGame(uint256 _id) public {
        uint256 result = block.timestamp % 2;
        if (result == 0) {
            emit Result(true);
        } else {
            emit Result(false);
        }
        games[_id] = games[games.length - 1];
        games.pop();
    }
}
