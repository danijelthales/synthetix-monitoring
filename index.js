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

router.get("/rebates/:addressParam", async (req, res) => {
    var resultOwedMap = new Object();
    await getOwing(req.params.addressParam, resultOwedMap);
    res.render("rebates", {title: "Synths", synths: synths, resultOwedMap: resultOwedMap});
});

router.get("/rebates/", async (req, res) => {
    res.render("rebatesBase");
});

router.get("/verify", (req, res) => {
    res.render("verify", {title: "Hey", message: "Hello there!"});
});

router.get('/table-sort.js', function (req, res) {
    res.sendFile(path.join(__dirname + '/table-sort.js'));
});

router.get('/finish.js', function (req, res) {
    res.sendFile(path.join(__dirname + '/finish.js'));
});

router.get('/rebatesFinish.js', function (req, res) {
    res.sendFile(path.join(__dirname + '/rebatesFinish.js'));
});

router.get('/verify.js', function (req, res) {
    res.sendFile(path.join(__dirname + '/verify.js'));
});

router.get('/web3.min.js', function (req, res) {
    res.sendFile(path.join(__dirname + '/web3.min.js'));
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
let totalInUSD = 0;

const smallDeviationSynths = ["sBTC", "sETH", "sEUR", "sAUD", "sGBP", "sJPY", "sUSD", "sCHF", "sNIKKEI", "sFTSE", "sXAG", "sXAU", "sOIL", "iOIL", "iETH", "iBTC"]

setInterval(async () => {
        try {

            const synths = snxjs.contractSettings.synths.map(({name}) => name);

            for (let synth in synths) {
                console.log("getting synth: " + synths[synth]);
                await getSynthInfo(synths[synth], resultsMap);
                results = Array.from(resultsMap.values());
            }
            totalInUSD = 0;
            results.forEach(r => {
                totalInUSD += r.totalSupplyInUSDPure;
            });
            resultsMap.forEach((value, key) => {
                if (value.synthPercentage == "0") {
                    value.synthPercentage = value.totalSupplyInUSDPure * 100 / totalInUSD;
                    value.synthPercentage = value.synthPercentage.toFixed(2) + "%";
                    resultsMap.set(key, value);
                }
            });
            results = Array.from(resultsMap.values());
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
    let totalSupply = (formatEther(totalAmount) * 1.0).toFixed(2);
    let rateForSynth = await snxjs.ExchangeRates.contract.rateForCurrency(toUtf8Bytes(synth), blockOptions) / 1e18;
    const totalSupplyCalc = formatEther(totalAmount);
    const rateForSynthCalc = await snxjs.ExchangeRates.contract.rateForCurrency(toUtf8Bytes(synth), blockOptions) / 1e18;
    let totalSupplyInUSD = rateForSynthCalc * totalSupplyCalc;
    let totalSupplyInUSDPure = totalSupplyInUSD;
    totalSupplyInUSD = numberWithCommas(totalSupplyInUSD.toFixed(0));
    rateForSynth = rateForSynth.toFixed(2)
    totalSupply = numberWithCommas(totalSupply);
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

    let synthPercentage = 0;
    if (totalInUSD > 0) {
        synthPercentage = totalSupplyInUSDPure * 100 / totalInUSD;
        synthPercentage = synthPercentage.toFixed(2) + "%";
    }


    let inverse = await snxjs.ExchangeRates.inversePricing(toUtf8Bytes(synth));
    let entryLimit = (inverse[0].toString() / 1e18).toFixed(2);
    let upperLimit = (inverse[1].toString() / 1e18).toFixed(2);
    let lowerLimit = (inverse[2].toString() / 1e18).toFixed(2);
    if (entryLimit == "0.00") {
        entryLimit = "N/A";
    }
    if (upperLimit == "0.00") {
        upperLimit = "N/A";
    }
    if (lowerLimit == "0.00") {
        lowerLimit = "N/A";
    }

    let key = toUtf8Bytes(synth);

    console.log(synth + " frozen value is: ", rateIsFrozen);
    resultsMap.set(synth, {
        synth,
        key,
        totalAmount,
        totalSupply,
        rateForSynth,
        totalSupplyInUSD,
        totalSupplyInUSDPure,
        synthPercentage,
        rateIsFrozen,
        leverage,
        fee,
        clThreshold,
        suggestedFee,
        riskFactor,
        risky,
        entryLimit,
        upperLimit,
        lowerLimit
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

const synths = snxjs.contractSettings.synths.map(({name}) => name);

async function getOwing(address, resultOwedMap) {
    for (let synth in synths) {
        console.log("getting synth: " + synths[synth]);
        await snxjs.Exchanger.settlementOwing(address, toUtf8Bytes(synths[synth])).then(r => {
            console.log(r);
            var reclaimAmount = r[0].toString() * 1.0 / 1e18;
            reclaimAmount = reclaimAmount.toFixed(3);
            var rebateAmount = r[1].toString() * 1.0 / 1e18;
            rebateAmount = rebateAmount.toFixed(3);
            resultOwedMap[synths[synth]] = {reclaimAmount, rebateAmount};
        })
    }
}

