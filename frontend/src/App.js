import "./App.css";
import { useEffect, useState } from "react";
import Web3 from "web3";
import FLIP_JSON from "./Flip.json";

// const HARDHAT_NETWORK_ID = "31337";
const contractAddress = "0x5fbdb2315678afecb367f032d93f642f64180aa3";
let contract;

function App() {
  let [address, setAddress] = useState();
  let [games, setGames] = useState([]);

  useEffect(() => {
    let web3Provider = window.ethereum;
    const web3 = new Web3(web3Provider || "http://127.0.0.1:8545");
    contract = new web3.eth.Contract(FLIP_JSON.abi, contractAddress);

    web3.eth
      .getChainId()
      .then((chainId) => console.log(`chainId is ${chainId}`));

    web3.eth.getAccounts().then((accounts) => {
      setAddress(accounts[0]);
    });

    updateGames();
  }, []);

  const openGame = () => {
    contract.methods
      .openGame(1)
      .send({ from: address })
      .then(() => {
        updateGames();
      });
  };

  const AcceptGame = (id) => {
    contract.once("Result", (res) => {
      console.log(res);
    });
    contract.methods
      .acceptGame(id)
      .send({ from: address })
      .then(() => {
        updateGames();
      });
  };

  const updateGames = () => {
    contract.methods
      .getGames()
      .call()
      .then((games) => {
        setGames(games);
      });
  };

  return (
    <div className="App">
      <p>Your current address is: {address}</p>
      <button onClick={openGame}>Open game</button>
      {games.map((game, i) => (
        <div className="game-container" key={i}>
          <p>Initiator: {game.initiator}</p>
          <p>Amount: {game.amount}</p>
          <button onClick={() => AcceptGame(i)}>Accept</button>
        </div>
      ))}
    </div>
  );
}

export default App;
