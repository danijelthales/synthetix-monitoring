require("dotenv").config()

var express = require("express");
var app = express();

const path = require("path");
const router = express.Router();

app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

router.get("/", (req, res) => {
    res.render("synths", {title: "Synths", synths: results});
});

router.get("/about", (req, res) => {
    res.render("about", {title: "Hey", message: "Hello there!"});
});

router.get('/table-sort.js', function (req, res) {
    res.sendFile(path.join(__dirname + '/table-sort.js'));
});

router.get('/finish.js', function (req, res) {
    res.sendFile(path.join(__dirname + '/finish.js'));
});

let resultsMap = new Map();
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

const smallDeviationSynths = ["sBTC", "sETH", "sEUR", "sAUD", "sGBP", "sJPY", "sUSD", "sCHF", "sNIKKEI", "sFTSE", "sXAG", "sXAU", "sOIL", "iOIL", "iETH", "iBTC"]

setInterval(async () => {
        try {

            const synths = snxjs.contractSettings.synths.map(({name}) => name);


            let totalInUSD = 0;
            let totalInUSDAboveTwoPercent = 0;
            for (let synth in synths) {
                console.log("getting synth: " + synths[synth]);
                await getSynthInfo(synths[synth], resultsMap);
                results = Array.from(resultsMap.values());
            }
            console.log(results);
        } catch (e) {
            console.log("Error in periodic rebalancing check ", e);
        }
    }
    ,
    1000 * 60 * 5
);

setTimeout(async () => {
        try {

            const synths = snxjs.contractSettings.synths.map(({name}) => name);


            let totalInUSD = 0;
            let totalInUSDAboveTwoPercent = 0;
            for (let synth in synths) {
                console.log("getting synth: " + synths[synth]);
                await getSynthInfo(synths[synth], resultsMap);
                results = Array.from(resultsMap.values());
            }
            console.log(results);
        } catch (e) {
            console.log("Error in periodic rebalancing check ", e);
        }
    }
    ,
    1000 * 30
);

async function getSynthInfo(synth, resultsMap) {
    const totalAmount = await snxjs[synth].contract.totalSupply(blockOptions);
    const totalSupply = numberWithCommas((formatEther(totalAmount) * 1.0).toFixed(2));
    let rateForSynth = await snxjs.ExchangeRates.contract.rateForCurrency(toUtf8Bytes(synth), blockOptions) / 1e18;
    rateForSynth = rateForSynth.toFixed(2)
    const totalSupplyInUSD = numberWithCommas(rateForSynth * (formatEther(totalAmount) * 1.0).toFixed(2));
    const rateIsFrozen = await snxjs.ExchangeRates.contract.rateIsFrozen(toUtf8Bytes(synth), blockOptions);
    let leverage = 1;
    let susdKey = await snxjs.sUSD.currencyKey();
    let fee = await snxjs.Exchanger.feeRateForExchange(susdKey, toUtf8Bytes(synth));
    fee = formatEther(fee) * 100;
    if (synth.toLowerCase() == 'susd') {
        fee = "N/A"
    }

    let clThreshold = 1;
    if (smallDeviationSynths.includes(synth)) {
        clThreshold = 0.5;
    }
    if (synth.startsWith("i")) {

        let longSynth = "s" + synth.substring(1, synth.length);
        let rateForLong = await snxjs.ExchangeRates.contract.rateForCurrency(toUtf8Bytes(longSynth), blockOptions) / 1e18;
        let calculatedLeverage = rateForLong / rateForSynth;
        leverage = calculatedLeverage.toFixed(2);
    }
    let suggestedFee = leverage * clThreshold;
    let riskFactor = suggestedFee - fee;
    riskFactor = riskFactor.toFixed(2);
    let risky = riskFactor > 0;
    fee = (fee * 1.0).toFixed(2) + '%';
    suggestedFee = suggestedFee + '%';
    clThreshold = clThreshold + '%';
    riskFactor = riskFactor + '%';

    console.log(synth + " frozen value is: ", rateIsFrozen);
    resultsMap.set(synth, {
        synth,
        totalAmount,
        totalSupply,
        rateForSynth,
        totalSupplyInUSD,
        rateIsFrozen,
        leverage,
        fee,
        clThreshold,
        suggestedFee,
        riskFactor,
        risky
    });
}

function getNumberLabel(labelValue) {

    // Nine Zeroes for Billions
    return Math.abs(Number(labelValue)) >= 1.0e+9

        ? Math.round(Math.abs(Number(labelValue)) / 1.0e+9) + "B"
        // Six Zeroes for Millions
        : Math.abs(Number(labelValue)) >= 1.0e+6

            ? Math.round(Math.abs(Number(labelValue)) / 1.0e+6) + "M"
            // Three Zeroes for Thousands
            : Math.abs(Number(labelValue)) >= 1.0e+3

                ? Math.round(Math.abs(Number(labelValue)) / 1.0e+3) + "K"

                : Math.abs(Number(labelValue));

}


function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
