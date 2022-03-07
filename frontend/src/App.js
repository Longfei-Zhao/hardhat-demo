import { useEffect, useState } from "react";
import Web3 from "web3";
import {
  Container,
  Box,
  Grid,
  Stack,
  Card,
  Divider,
  Paper,
  CardContent,
  CardActions,
  Avatar,
  Typography,
  FormControl,
  Select,
  MenuItem,
  TextField,
  Button,
  Modal,
} from "@mui/material";
import RenJS from "@renproject/ren";
import { Bitcoin, Ethereum, Terra } from "@renproject/chains";
import Identicon from "react-identicons";
import FLIP_JSON from "./Flip.json";
import "./App.css";
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

const COIN = {
  ETH: "ETH",
  BTC: "BTC",
  LUNA: "LUNA",
};

const contractAddress = "0x2A66347B4E85e8aCD4144AB495d48f4E7DCE724E";
let web3Provider = window.ethereum;
const web3 = new Web3(web3Provider || "http://127.0.0.1:8545");
const contract = new web3.eth.Contract(FLIP_JSON.abi, contractAddress);
const renJS = new RenJS("testnet", { useV2TransactionFormat: true, logger: console });

function App() {
  const modalStyle = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: 400,
    bgcolor: "#FAFAFA",
    border: "2px solid #000",
    boxShadow: 24,
    p: 4,
  };

  let [address, setAddress] = useState();
  let [recipientAddress, setRecipientAddress] = useState("");
  let [gatewayAddress, setGatewayAddress] = useState();
  let [userbalance, setUserBalance] = useState({
    ETH: 0,
    BTC: 0,
    LUNA: 0,
  });
  let [contractBalance, setContractBalance] = useState({
    ETH: 0,
    BTC: 0,
    LUNA: 0,
  });
  let [amount, setAmount] = useState("");
  let [games, setGames] = useState([]);

  let [createGameModalIsOpened, setCreateGameModalIsOpened] = useState(false);
  let [depositModalIsOpened, setDepositModalIsOpened] = useState(false);
  let [withdrawModalIsOpened, setWithdrawModalIsOpened] = useState(false);
  let [selectedCoin, setSelectedCoin] = useState(COIN.ETH);

  useEffect(() => {
    getAddress();
    getContractBalance();
    getGames();
  }, []);

  useEffect(() => {
    getUserBalance();
  }, [address]);

  const getAddress = () => {
    web3.eth.getAccounts().then((accounts) => {
      setAddress(accounts[0]);
    });
  };

  const getContractBalance = () => {
    web3.eth.getBalance(contractAddress).then((balance) => {
      setContractBalance((prevState) => ({
        ...prevState,
        ETH: web3.utils.fromWei(balance, "ether"),
      }));
    });
    contract.methods
      .getTotalBalance()
      .call()
      .then((balance) => {
        console.log("Contract Balance: ", balance);
        setContractBalance((prevState) => ({
          ...prevState,
          BTC: balance.btc,
          LUNA: balance.luna,
        }));
      });
  };

  const getUserBalance = () => {
    if (address) {
      web3.eth.getBalance(address).then((balance) => {
        console.log("User Balance(ETH): ", balance);
        setUserBalance((prevState) => ({
          ...prevState,
          ETH: web3.utils.fromWei(balance, "ether"),
        }));
      });
      contract.methods
        .getBalance()
        .call()
        .then((balance) => {
          console.log("User Balance: ", balance);
          setUserBalance((prevState) => ({
            ...prevState,
            BTC: balance.btc,
            LUNA: balance.luna,
          }));
        });
    }
  };

  const getGames = () => {
    contract.methods
      .getGames()
      .call()
      .then((games) => {
        console.log("Games: ", games);
        setGames(games);
      });
  };

  const deposit = async (symbol) => {
    if (symbol === COIN.ETH) {
      return false;
    };
    const mint = await renJS.lockAndMint({
      asset: symbol,
      from: symbol === COIN.BTC ? Bitcoin() : Terra(),
      to: Ethereum(web3.currentProvider).Contract({
        sendTo: contractAddress,
        contractFn: symbol === COIN.BTC ? "depositBTC" : "depositLUNA",
        contractParams: [
          {
            name: "_msg",
            type: "bytes",
            value: Buffer.from(`Depositing ${amount} BTC`),
          },
        ],
      }),
    });
    setGatewayAddress(mint.gatewayAddress);
    mint.on("deposit", async (deposit) => {
      const hash = deposit.txHash();
      console.log(hash);
      const depositLog = (msg) =>
        console.log(
          `BTC deposit: ${Bitcoin.utils.transactionExplorerLink(
            deposit.depositDetails.transaction,
            "testnet"
          )}\n
            RenVM Hash: ${hash}\n
            Status: ${deposit.status}\n
            ${msg}`
        );

      await deposit
        .confirmed()
        .on("target", (target) => depositLog(`0/${target} confirmations`))
        .on("confirmation", (confs, target) =>
          depositLog(`${confs}/${target} confirmations`)
        );

      await deposit
        .signed()
        // Print RenVM status - "pending", "confirming" or "done".
        .on("status", (status) => depositLog(`Status: ${status}`));

      await deposit
        .mint()
        // Print Ethereum transaction hash.
        .on("transactionHash", (txHash) => depositLog(`Mint tx: ${txHash}`));

      console.log(`Deposited ${amount} BTC.`);
    });
  };

  const withdraw = async (symbol, recipientAddress, amount) => {
    const burnAndRelease = await renJS.burnAndRelease({
      // Send BTC from Ethereum back to the Bitcoin blockchain.
      asset: symbol,
      to:
        symbol === COIN.BTC
          ? Bitcoin().Address(recipientAddress)
          : Terra().Address(recipientAddress),
      from: Ethereum(web3.currentProvider).Contract((recipientAddress) => ({
        sendTo: contractAddress,

        contractFn: "withdraw",

        contractParams: [
          {
            type: "string",
            name: "_symbol",
            value: symbol,
          },
          {
            type: "bytes",
            name: "_to",
            value: recipientAddress,
          },
          {
            type: "uint256",
            name: "_amount",
            value:
              symbol === COIN.BTC
                ? RenJS.utils.toSmallestUnit(amount, 8)
                : RenJS.utils.toSmallestUnit(amount, 8),
          },
        ],
      })),
    });
    let confirmations = 0;
    await burnAndRelease
      .burn()
      // Ethereum transaction confirmations.
      .on("confirmation", (confs) => {
        confirmations = confs;
      })
      // Print Ethereum transaction hash.
      .on("transactionHash", (txHash) =>
        console.log(`Ethereum transaction: ${String(txHash)}\nSubmitting...`)
      );

    await burnAndRelease
      .release()
      // Print RenVM status - "pending", "confirming" or "done".
      .on("status", (status) =>
        status === "confirming"
          ? console.log(`${status} (${confirmations}/15)`)
          : console.log(status)
      )
      // Print RenVM transaction hash
      .on("txHash", (hash) => console.log(`RenVM hash: ${hash}`));

    console.log(`Withdrew ${amount} BTC to ${recipientAddress}.`);
  };

  const openGame = async (symbol, amount) => {
    contract.methods
      .openGame(symbol, web3.utils.toWei(amount, "ether"))
      .send({ from: address, value: web3.utils.toWei(amount, "ether") })
      .then(() => {
        update();
      });

    setCreateGameModalIsOpened(false);
  };

  const acceptGame = (id, amount) => {
    if (games[id].symbol === COIN.ETH) {
      contract.methods
        .acceptGame(id)
        .send({ from: address, value: amount })
        .then(() => {
          update();
        });
    }
    else {
      contract.methods
        .acceptGame(id)
        .call()
        .then(() => {
          update();
        });
    }
    contract.once("Result", (error, event) => {
      console.log(event);
    });
  };

  const update = () => {
    getGames();
    getContractBalance();
    getAddress();
    getUserBalance();
  };

  const handleCloseCreateGameModal = () => {
    setAmount("");
    setSelectedCoin(COIN.ETH);
    setGatewayAddress("");
    setCreateGameModalIsOpened(false);
  };

  const handleCloseDepositModal = () => {
    setAmount("");
    setSelectedCoin(COIN.ETH);
    setGatewayAddress("");
    setDepositModalIsOpened(false);
  };

  const handleCloseWithdrawModal = () => {
    setAmount("");
    setSelectedCoin(COIN.ETH);
    setRecipientAddress("");
    setWithdrawModalIsOpened(false);
  };

  const handleCoinSelectChange = (event) => {
    setSelectedCoin(event.target.value);
  };

  return (
    <div className="App">
      <Container maxWidth="xl">
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems="center"
          divider={<Divider orientation="vertical" flexItem />}
          spacing={5}
          mt={3}
        >
          <Typography variant="h1">COIN FLIP</Typography>
          <Stack>
            <Typography variant="h6">Contract Balance</Typography>
            <Typography variant="h4" sx={{ color: "#009688" }}>
              {Number(contractBalance.ETH).toFixed(2)} ETH /{" "}
              {contractBalance.BTC} BTC /{Number(contractBalance.LUNA)} LUNA
            </Typography>
          </Stack>
          <Stack>
            <Typography variant="h6">Opened Games</Typography>
            <Typography variant="h3" sx={{ color: "#009688" }}>
              {games.length}
            </Typography>
          </Stack>
        </Stack>
        <Paper
          sx={{
            bgcolor: "#009688",
            p: 3,
            mt: 3,
            color: "#FAFAFA",
          }}
        >
          <Stack direction="row" alignItems="center" spacing={3}>
            <Avatar
              sx={{
                width: 60,
                height: 60,
                background: "#FAFAFA",
              }}
            >
              <Identicon string={address} size={50} />
            </Avatar>
            <Typography variant="h4">
              {Number(userbalance.ETH).toFixed(4)} <sup>ETH</sup>/
              {Number(userbalance.BTC).toFixed(4)} <sup>BTC</sup>/
              {Number(userbalance.LUNA).toFixed(4)} <sup>LUNA</sup>
            </Typography>
          </Stack>
        </Paper>
        <Stack direction="row" spacing={2} mt={3}>
          <Button
            variant="outlined"
            onClick={() => setCreateGameModalIsOpened(true)}
          >
            Flip a Coin
          </Button>
          <Button variant="outlined" onClick={update}>
            Refresh
          </Button>
          <Button
            variant="outlined"
            onClick={() => setDepositModalIsOpened(true)}
          >
            Deposit
          </Button>
          <Button
            variant="outlined"
            onClick={() => setWithdrawModalIsOpened(true)}
          >
            Withdraw
          </Button>
        </Stack>

        <Modal
          open={depositModalIsOpened}
          onClose={handleCloseDepositModal}
          aria-labelledby="modal-modal-title"
          aria-describedby="modal-modal-description"
        >
          <Box sx={modalStyle}>
            <Stack spacing={5}>
              <Stack spacing={2} direction="row">
                <TextField
                  autoFocus
                  label={`Amount (${selectedCoin})`}
                  variant="standard"
                  value={amount}
                  type="number"
                  onChange={(e) => setAmount(e.target.value)}
                />
                <FormControl>
                  <Select
                    value={selectedCoin}
                    onChange={handleCoinSelectChange}
                  >
                    <MenuItem value={COIN.BTC}>BTC</MenuItem>
                    <MenuItem value={COIN.LUNA}>LUNA</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
              <Typography variant="body">
                Gateway Address: {gatewayAddress}
              </Typography>
              <Stack spacing={2} direction="row">
                <Button
                  variant="contained"
                  onClick={() => deposit(selectedCoin)}
                >
                  Deposit
                </Button>
                <Button
                  variant="contained"
                  onClick={handleCloseDepositModal}
                  color="error"
                >
                  Cancel
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Modal>

        <Modal
          open={withdrawModalIsOpened}
          onClose={handleCloseWithdrawModal}
          aria-labelledby="modal-modal-title"
          aria-describedby="modal-modal-description"
        >
          <Box sx={modalStyle}>
            <Stack spacing={5}>
              <Stack spacing={2} direction="row">
                <TextField
                  autoFocus
                  label={`Amount (${selectedCoin})`}
                  variant="standard"
                  value={amount}
                  type="number"
                  onChange={(e) => setAmount(e.target.value)}
                />
                <FormControl>
                  <Select
                    value={selectedCoin}
                    onChange={handleCoinSelectChange}
                  >
                    <MenuItem value={COIN.BTC}>BTC</MenuItem>
                    <MenuItem value={COIN.LUNA}>LUNA</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
              <TextField
                autoFocus
                label="Recipient address"
                variant="standard"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
              />
              <Stack spacing={2} direction="row">
                <Button
                  variant="contained"
                  onClick={(selectedCoin, recipientAddress, amount) =>
                    withdraw(selectedCoin, recipientAddress, amount)
                  }
                >
                  Withdraw
                </Button>
                <Button
                  variant="contained"
                  onClick={handleCloseDepositModal}
                  color="error"
                >
                  Cancel
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Modal>

        <Modal
          open={createGameModalIsOpened}
          onClose={handleCloseCreateGameModal}
          aria-labelledby="modal-modal-title"
          aria-describedby="modal-modal-description"
        >
          <Box sx={modalStyle}>
            <Stack spacing={5}>
              <Stack spacing={2} direction="row">
                <TextField
                  autoFocus
                  label={`Amount (${selectedCoin})`}
                  variant="standard"
                  value={amount}
                  type="number"
                  onChange={(e) => setAmount(e.target.value)}
                />
                <FormControl>
                  <Select
                    value={selectedCoin}
                    onChange={handleCoinSelectChange}
                  >
                    <MenuItem value={COIN.ETH}>ETH</MenuItem>
                    <MenuItem value={COIN.BTC}>BTC</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
              <Stack spacing={2} direction="row">
                <Button
                  variant="contained"
                  onClick={() => openGame(selectedCoin, amount)}
                >
                  Bet
                </Button>
                <Button
                  variant="contained"
                  onClick={handleCloseCreateGameModal}
                  color="error"
                >
                  Cancel
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Modal>

        <Grid container spacing={2} mt={2}>
          {games.map((game, i) => (
            <Grid item key={i} xs={12} sm={6} md={4} lg={3}>
              <Card>
                <CardContent>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar
                      sx={{
                        width: 40,
                        height: 40,
                        background: "#FAFAFA",
                      }}
                    >
                      <Identicon string={game.initiator} size={30} />
                    </Avatar>
                    <Typography variant="body2">
                      {game.initiator !== address
                        ? game.initiator
                        : "Created By You"}
                    </Typography>
                  </Stack>
                  <Typography variant="h4" sx={{ textAlign: "center", mt: 5 }}>
                    {Number(web3.utils.fromWei(game.amount, "ether")).toFixed(
                      6
                    )}
                    {game.symbol}
                  </Typography>
                </CardContent>
                <CardActions>
                  {game.initiator !== address ? (
                    <Button
                      variant="text"
                      onClick={() => acceptGame(i, game.amount)}
                    >
                      Accept
                    </Button>
                  ) : (
                    <Button variant="text" disabled>
                      Waiting
                    </Button>
                  )}
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </div>
  );
}

export default App;
