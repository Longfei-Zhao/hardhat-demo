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

  enum Symbol {
    ETH,
    BTC,
    LUNA
  }

  struct Game {
    address initiator;
    uint256 amount;
    string symbol;
  }
  Game[] private games;
  struct Balance {
    uint256 btc;
    uint256 luna;
  }
  Balance private totalBalance;
  mapping(address => Balance) private balance;

  event Deposit(uint256 _amount, bytes _msg);
  event Withdrawal(uint256 burnedAmount);
  event Result(bool result);

  constructor(IGatewayRegistry _registry) {
    registry = _registry;
  }

  function compareStringsbyBytes(string memory s1, string memory s2)
    public
    pure
    returns (bool)
  {
    return keccak256(abi.encodePacked(s1)) == keccak256(abi.encodePacked(s2));
  }

  function deposit(
    string calldata _symbol,
    // Parameters from RenVM
    uint256 _amount,
    bytes32 _nHash,
    bytes memory _sig
  ) private {
    bytes32 pHash = keccak256(abi.encode(_symbol));
    uint256 mintedAmount = registry.getGatewayBySymbol(_symbol).mint(
      pHash,
      _amount,
      _nHash,
      _sig
    );
    if (compareStringsbyBytes(_symbol, "BTC")) {
      balance[msg.sender].btc += mintedAmount;
      totalBalance.btc += mintedAmount;
    }
    if (compareStringsbyBytes(_symbol, "LUNA")) {
      balance[msg.sender].luna += mintedAmount;
      totalBalance.luna += mintedAmount;
    }
    emit Deposit(mintedAmount, _sig);
  }

  function depositBTC(
    // Parameters from users
    bytes calldata _msg,
    // Parameters from RenVM
    uint256 _amount,
    bytes32 _nHash,
    bytes calldata _sig
  ) private {
    bytes32 pHash = keccak256(abi.encode(_msg));
    uint256 mintedAmount = registry.getGatewayBySymbol("BTC").mint(
      pHash,
      _amount,
      _nHash,
      _sig
    );
    balance[msg.sender].btc += mintedAmount;
    totalBalance.btc += mintedAmount;

    emit Deposit(mintedAmount, _msg);
  }

  function depositLUNA(
    // Parameters from users
    bytes calldata _msg,
    // Parameters from RenVM
    uint256 _amount,
    bytes32 _nHash,
    bytes calldata _sig
  ) private {
    bytes32 pHash = keccak256(abi.encode(_msg));
    uint256 mintedAmount = registry.getGatewayBySymbol("LUNA").mint(
      pHash,
      _amount,
      _nHash,
      _sig
    );
    balance[msg.sender].luna += mintedAmount;
    totalBalance.luna += mintedAmount;
    emit Deposit(mintedAmount, _msg);
  }

  function withdraw(
    string calldata _symbol,
    bytes calldata _to,
    uint256 _amount
  ) external {
    if (compareStringsbyBytes(_symbol, "BTC")) {
      require(balance[msg.sender].btc >= _amount, "Deposit Amount Error");
      balance[msg.sender].btc -= _amount;
      totalBalance.btc -= _amount;
    }
    if (compareStringsbyBytes(_symbol, "LUNA")) {
      require(balance[msg.sender].luna >= _amount, "Deposit Amount Error");
      balance[msg.sender].luna -= _amount;
      totalBalance.luna -= _amount;
    }
    uint256 burnedAmount = registry.getGatewayBySymbol(_symbol).burn(
      _to,
      _amount
    );
    emit Withdrawal(burnedAmount);
  }

  function openGame(string calldata _symbol, uint256 _amount) external payable {
    if (compareStringsbyBytes(_symbol, "ETH")) {
      games.push(
        Game({ initiator: msg.sender, amount: msg.value, symbol: _symbol })
      );
    } else {
      if (compareStringsbyBytes(_symbol, "BTC")) {
        require(_amount <= balance[msg.sender].btc, "Balance Insufficient");
        balance[msg.sender].btc -= _amount;
      }
      if (compareStringsbyBytes(_symbol, "LUNA")) {
        require(_amount <= balance[msg.sender].luna, "Balance Insufficient");
        balance[msg.sender].luna -= _amount;
      }
      games.push(
        Game({ initiator: msg.sender, amount: _amount, symbol: _symbol })
      );
    }
  }

  function acceptGame(uint256 _id) external payable {
    bool result = uint256(
      keccak256(abi.encodePacked(block.difficulty, block.timestamp))
    ) %
      2 ==
      0;
    if (compareStringsbyBytes(games[_id].symbol, "ETH")) {
      require(msg.value == games[_id].amount, "Amount Error");
      if (result) {
        payable(msg.sender).transfer(games[_id].amount * 2);
      } else {
        payable(games[_id].initiator).transfer(games[_id].amount * 2);
      }
    } else {
      if (compareStringsbyBytes(games[_id].symbol, "BTC")) {
        require(
          games[_id].amount <= balance[msg.sender].btc,
          "Balance Insufficient"
        );
      }
      if (compareStringsbyBytes(games[_id].symbol, "LUNA")) {
        require(
          games[_id].amount <= balance[msg.sender].luna,
          "Balance Insufficient"
        );
      }
      if (result) {
        if (compareStringsbyBytes(games[_id].symbol, "BTC")) {
          balance[msg.sender].btc += games[_id].amount;
          balance[games[_id].initiator].btc -= games[_id].amount;
        }
        if (compareStringsbyBytes(games[_id].symbol, "LUNA")) {
          balance[msg.sender].luna += games[_id].amount;
          balance[games[_id].initiator].luna -= games[_id].amount;
        }
      } else {
        if (compareStringsbyBytes(games[_id].symbol, "BTC")) {
          balance[msg.sender].btc -= games[_id].amount;
          balance[games[_id].initiator].btc += games[_id].amount;
        }
        if (compareStringsbyBytes(games[_id].symbol, "LUNA")) {
          balance[msg.sender].luna -= games[_id].amount;
          balance[games[_id].initiator].luna += games[_id].amount;
        }
      }
    }
    emit Result(result);
    games[_id] = games[games.length - 1];
    games.pop();
  }

  function flip() private view returns (bool) {
    return
      uint256(keccak256(abi.encodePacked(block.difficulty, block.timestamp))) %
        2 ==
      0;
  }

  function getTotalBalance() public view returns (Balance memory) {
    return totalBalance;
  }

  function getBalance() public view returns (Balance memory) {
    return balance[msg.sender];
  }

  function getGames() public view returns (Game[] memory) {
    return games;
  }
}
