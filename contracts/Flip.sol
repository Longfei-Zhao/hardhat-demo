//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface IERC20 {
  function balanceOf(address account) external view returns (uint256);
}

interface IGateway {
  function mint(
    bytes32 _pHash,
    uint256 _amount,
    bytes32 _nHash,
    bytes calldata _sig
  ) external returns (uint256);

  function burn(bytes calldata _to, uint256 _amount) external returns (uint256);
}

interface IGatewayRegistry {
  function getGatewayBySymbol(string calldata _tokenSymbol)
    external
    view
    returns (IGateway);

  function getTokenBySymbol(string calldata _tokenSymbol)
    external
    view
    returns (IERC20);
}

contract Flip {
  IGatewayRegistry public registry;
  struct Game {
    address initiator;
    bytes initiatorBtcAddress;
    uint256 amount;
    bool isEth;
  }

  Game[] private games;

  event Result(bool result);

  constructor(IGatewayRegistry _registry) {
    registry = _registry;
  }

  function depositBtc(
    bytes memory _msg,
    uint256 _amount,
    bytes32 _nHash,
    bytes memory _sig
  ) private returns (uint256 mintedAmount) {
    bytes32 pHash = keccak256(abi.encode(_msg));
    return
      registry.getGatewayBySymbol("BTC").mint(pHash, _amount, _nHash, _sig);
    // emit Deposit(mintedAmount, _msg);
  }

  function openGameWithEth() external payable {
    games.push(
      Game({
        initiator: msg.sender,
        initiatorBtcAddress: "",
        amount: msg.value,
        isEth: true
      })
    );
  }

  function openGameWithBtc(
    // Parameters from users
    bytes calldata _msg,
    bytes calldata _btcAddress,
    // Parameters from RenVM
    uint256 _amount,
    bytes32 _nHash,
    bytes calldata _sig
  ) external {
    uint256 mintedAmount = depositBtc(_msg, _amount, _nHash, _sig);
    games.push(
      Game({
        initiator: msg.sender,
        initiatorBtcAddress: _btcAddress,
        amount: mintedAmount,
        isEth: false
      })
    );
  }

  //   function openGame(
  //     // Parameters from users
  //     bool isEth,
  //     bytes calldata _msg,
  //     bytes calldata _btcAddress,
  //     // Parameters from RenVM
  //     uint256 _amount,
  //     bytes32 _nHash,
  //     bytes calldata _sig
  //   ) external payable {
  //     if (isEth) {
  //       games.push(
  //         Game({
  //           initiator: msg.sender,
  //           initiatorBtcAddress: "",
  //           amount: msg.value,
  //           isEth: isEth
  //         })
  //       );
  //     } else {
  //       uint256 mintedAmount = depositBtc(_msg, _amount, _nHash, _sig);
  //       games.push(
  //         Game({
  //           initiator: msg.sender,
  //           initiatorBtcAddress: _btcAddress,
  //           amount: mintedAmount,
  //           isEth: false
  //         })
  //       );
  //     }
  //   }

  //   function acceptGame(
  //     // Parameters from users
  //     uint256 _id,
  //     bytes calldata _msg,
  //     bytes calldata _btcAddress,
  //     // Parameters from RenVM
  //     uint256 _amount,
  //     bytes32 _nHash,
  //     bytes calldata _sig
  //   ) external payable {
  //     bool result = uint256(
  //       keccak256(abi.encodePacked(block.difficulty, block.timestamp))
  //     ) %
  //       2 ==
  //       0;
  //     if (games[_id].isEth) {
  //       address payable winner;
  //       if (result) {
  //         winner = payable(msg.sender);
  //       } else {
  //         winner = payable(games[_id].initiator);
  //       }
  //       if (msg.value == games[_id].amount) {
  //         winner.transfer(games[_id].amount * 2);
  //         emit Result(result);
  //         games[_id] = games[games.length - 1];
  //         games.pop();
  //       } else {
  //         revert("Amount Error!");
  //       }
  //     } else {
  //       uint256 mintedAmount = this.depositBtc(_msg, _amount, _nHash, _sig);
  //       bytes memory winner;
  //       if (result) {
  //         winner = _btcAddress;
  //       } else {
  //         winner = games[_id].initiatorBtcAddress;
  //       }
  //       if (mintedAmount == games[_id].amount) {
  //         uint256 burnedAmount = registry.getGatewayBySymbol("BTC").burn(
  //           winner,
  //           mintedAmount * 2
  //         );
  //         // emit Withdrawal(_to, burnedAmount, _msg);
  //         emit Result(result);
  //         games[_id] = games[games.length - 1];
  //         games.pop();
  //       } else {
  //         revert("Amount Error!");
  //       }
  //     }
  //   }

  function flip() private view returns (bool) {
    return
      uint256(keccak256(abi.encodePacked(block.difficulty, block.timestamp))) %
        2 ==
      0;
  }

  function acceptGameWithEth(uint256 _id) external payable {
    if (games[_id].isEth == false) {
      revert("Type Error!");
    }
    if (msg.value != games[_id].amount) {
      revert("Amount Error!");
    }
    bool result = flip();
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

  function acceptGameWithBtc(
    // Parameters from users
    uint256 _id,
    bytes calldata _msg,
    bytes calldata _btcAddress,
    // Parameters from RenVM
    uint256 _amount,
    bytes32 _nHash,
    bytes calldata _sig
  ) external {
    if (games[_id].isEth == true) {
      revert("Type Error!");
    }
    uint256 mintedAmount = depositBtc(_msg, _amount, _nHash, _sig);
    if (mintedAmount != games[_id].amount) {
      revert("Amount Error!");
    }
    bool result = flip();
    bytes memory winner;
    if (result) {
      winner = _btcAddress;
    } else {
      winner = games[_id].initiatorBtcAddress;
    }
    uint256 burnedAmount = registry.getGatewayBySymbol("BTC").burn(
      winner,
      mintedAmount * 2
    );
    // emit Withdrawal(_to, burnedAmount, _msg);
    emit Result(result);
    games[_id] = games[games.length - 1];
    games.pop();
  }

  function getBtcBalance() public view returns (uint256) {
    return registry.getTokenBySymbol("BTC").balanceOf(address(this));
  }

  function getGames() public view returns (Game[] memory) {
    return games;
  }
}
