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
import { Bitcoin, Ethereum } from "@renproject/chains";
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
};
// const HARDHAT_NETWORK_ID = "31337";
const contractAddress = "0xcD2FAC21a5ed4386a2f8e4D6ea8F372320545fC9";
let web3Provider = window.ethereum;
const web3 = new Web3(web3Provider || "http://127.0.0.1:8545");
const contract = new web3.eth.Contract(FLIP_JSON.abi, contractAddress);
const renJS = new RenJS("testnet", { useV2TransactionFormat: true });

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
  let [btcAddress, setBtcAddress] = useState("");
  let [gatewayAddress, setGatewayAddress] = useState();
  let [balance, setBalance] = useState();
  let [btcBalance, setBtcBalance] = useState();
  let [contractBalance, setContractBalance] = useState();
  let [amount, setAmount] = useState("");
  let [games, setGames] = useState([]);

  let [createGameModalIsOpened, setCreateGameModalIsOpened] = useState(false);
  let [selectedCoin, setSelectedCoin] = useState(COIN.ETH);

  useEffect(() => {
    getAddress();
    getContractEthBalance();
    getContractBtcBalance();
    updateGames();
  }, []);

  useEffect(() => {
    updateBalance();
  }, [address]);

  const openGame = async () => {
    if (selectedCoin === COIN.ETH) {
      contract.methods
        .openGameWithEth()
        .send({ from: address, value: web3.utils.toWei(amount, "ether") })
        .then(() => {
          update();
        });

      setCreateGameModalIsOpened(false);
    } else {
      const mint = await renJS.lockAndMint({
        asset: "BTC",
        from: Bitcoin(),
        to: Ethereum(web3.currentProvider).Contract({
          sendTo: contractAddress,
          // The name of the function we want to call
          contractFn: "openGameWithBtc",
          // Arguments expected for calling `deposit`
          contractParams: [
            {
              name: "_msg",
              type: "bytes",
              value: Buffer.from(`Depositing ${amount} BTC`),
            },
            {
              name: "_btcAddress",
              type: "bytes",
              value: Buffer.from(btcAddress),
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
    }
  };

  const acceptGame = (id, amount) => {
    contract.methods
      .acceptGame(id)
      .send({ from: address, value: amount })
      .then(() => {
        update();
      });
    contract.once("Result", (error, event) => {
      console.log(event);
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

  const getAddress = () => {
    web3.eth.getAccounts().then((accounts) => {
      setAddress(accounts[0]);
    });
  };

  const updateBalance = () => {
    if (address) {
      web3.eth.getBalance(address).then((balance) => {
        setBalance(web3.utils.fromWei(balance, "ether"));
      });
    }
  };

  const update = () => {
    updateGames();
    getContractEthBalance();
    getContractBtcBalance();
    getAddress();
    updateBalance();
  };

  const getContractEthBalance = () => {
    web3.eth.getBalance(contractAddress).then((balance) => {
      setContractBalance(web3.utils.fromWei(balance, "ether"));
    });
  };

  const getContractBtcBalance = () => {
    contract.methods
      .getBtcBalance()
      .call()
      .then((btcBalance) => {
        setBtcBalance(btcBalance);
      });
  };

  const handleCloseCreateGameModal = () => {
    setAmount("");
    setSelectedCoin(COIN.ETH);
    setBtcAddress("");
    setGatewayAddress("");
    setCreateGameModalIsOpened(false);
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
            <Typography variant="h3" sx={{ color: "#009688" }}>
              {Number(contractBalance).toFixed(2)} ETH / {btcBalance} BTC
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
            <Typography variant="h2">
              {Number(balance).toFixed(6)} <sup>ETH</sup>
            </Typography>
            <Typography variant="body2" alignSelf="flex-end">
              {address}
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
        </Stack>

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
              {selectedCoin === COIN.BTC && (
                <>
                  <TextField
                    autoFocus
                    label="BTC recipient address"
                    variant="standard"
                    value={btcAddress}
                    onChange={(e) => setBtcAddress(e.target.value)}
                  />
                  <Typography variant="body">
                    Gateway Address: {gatewayAddress}
                  </Typography>
                </>
              )}
              <Stack spacing={2} direction="row">
                <Button variant="contained" onClick={openGame}>
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
                    {game.isEth ? COIN.ETH : COIN.BTC}
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
