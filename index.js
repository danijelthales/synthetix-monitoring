require("dotenv").config()

var express = require("express");
var app = express();

const path = require("path");
const router = express.Router();

app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

router.get("/", (req, res) => {
    res.render("index");
});

router.get("/about", (req, res) => {
    res.render("about", {title: "Hey", message: "Hello there!"});
});

let results = [];
router.get("/synths", (req, res) => {
    res.render("synths", {title: "Synths", synths: results});
});

app.use("/", router);

app.listen(process.env.PORT || 3000, () => {
    console.log("Server running on port " + (process.env.PORT || 3000));
});


const ethers = require('ethers');
const BigNumber = require('ethers/utils/bignumber');
const SynthetixJs = require('synthetix-js');
const infura = new ethers.providers.InfuraProvider('homestead', process.env.ARCHIVE_NODE);
const snxjs = new SynthetixJs.SynthetixJs({provider: infura});
//
// const {SynthetixJs} = require('synthetix-js');
// const snxjs = new SynthetixJs(); //uses default ContractSettings - ethers.js default provider, mainnet

const toUtf8Bytes = SynthetixJs.SynthetixJs.utils.formatBytes32String;
const formatEther = snxjs.utils.formatEther;
const fromBlock = "";
const blockOptions = fromBlock ? {blockTag: Number(fromBlock)} : {};

setTimeout(async () => {
        try {

            const synths = snxjs.contractSettings.synths.map(({name}) => name);


            let totalInUSD = 0;
            let totalInUSDAboveTwoPercent = 0;
            results = [];
            for (let synth in synths) {
                console.log("getting synth: " + synths[synth]);
                await getSynthInfo(synths[synth], results);
            }
            console.log(results);
        } catch (e) {
            console.log("Error in periodic rebalancing check ", e);
        }
    }
    ,
    0.1 * 60 * process.env.POLL_INTERVAL
);

async function getSynthInfo(synth, results) {
    const totalAmount = await snxjs[synth].contract.totalSupply(blockOptions);
    const totalSupply = formatEther(totalAmount);
    const rateForSynth = await snxjs.ExchangeRates.contract.rateForCurrency(toUtf8Bytes(synth), blockOptions) / 1e18;
    const totalSupplyInUSD = rateForSynth * totalSupply;
    const rateIsFrozen = await snxjs.ExchangeRates.contract.rateIsFrozen(toUtf8Bytes(synth), blockOptions);
    let leverage = 1;
    let susdKey = await snxjs.sUSD.currencyKey();
    let fee = await snxjs.Exchanger.feeRateForExchange(susdKey, toUtf8Bytes(synth));
    fee = formatEther(fee) * 100 + '%';
    if (synth.toLowerCase() == 'susd') {
        fee = "N/A"
    }

    if (synth.startsWith("i")) {
        let longSynth = "s" + synth.substring(1, synth.length);
        let rateForLong = await snxjs.ExchangeRates.contract.rateForCurrency(toUtf8Bytes(longSynth), blockOptions) / 1e18;
        let calculatedLeverage = rateForLong / rateForSynth;
        leverage = calculatedLeverage.toFixed(2);
    }

    console.log(synth + " frozen value is: ", rateIsFrozen);
    results.push({synth, totalAmount, totalSupply, rateForSynth, totalSupplyInUSD, rateIsFrozen, leverage, fee});
}





