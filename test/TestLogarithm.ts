global.crypto = require("crypto");

import { expect, use } from "chai";
import { deployments, ethers } from "hardhat";
import { solidity } from "ethereum-waffle";
import Decimal from "decimal.js";

import { UnrolledCordic } from "../src/types/UnrolledCordic";

import { UnrolledCordic__factory } from "../src/types/factories/UnrolledCordic__factory";

import { BigNumber } from "ethers";

use(solidity);
Decimal.set({ precision: 120 });

const groundTruthRaw = require("./ground-truth.json");
const groundTruth = groundTruthRaw.map(([first, second]: [string, string]) => [
    first,
    new Decimal(second),
]);

const decToBN = (v: Decimal) => BigNumber.from(v.floor().toFixed());
const bnToDec = (v: BigNumber) => new Decimal(v.toString());

const baseMultiplierDec = new Decimal("1e+18");
const baseMultiplierBN = decToBN(baseMultiplierDec);

describe("Test Logarithms Algorithms", async () => {
    let cordic: UnrolledCordic;

    before(async () => {
        await deployments.fixture();
        const [user] = await ethers.getSigners();
        const UnrolledCordicAddress = (await deployments.get("UnrolledCordic"))
            .address;
        cordic = UnrolledCordic__factory.connect(UnrolledCordicAddress, user);
    });

    it("Check ground truth logs for Cordic", async () => {
        let max_err = new Decimal(0);
        let max_gas = BigNumber.from(0);
        let min_gas = BigNumber.from(ethers.constants.MaxUint256);
        const tasks = groundTruth.map(async ([x, logx]: [string, Decimal]) => {
            const raw = await cordic.log2Times1e18(x);
            const gas = await cordic.estimateGas.log2Times1e18(x);
            const result = bnToDec(raw).dividedBy("1e18");
            const err = Decimal.abs(result.minus(logx));
            if (err.greaterThan(max_err)) max_err = err;
            if (gas.gt(max_gas)) max_gas = gas;
            if (gas.lt(min_gas)) min_gas = gas;
        });
        await Promise.all(tasks);
        let errString = max_err.toSignificantDigits(10);
        console.debug(
            `\t\tGround truth logs of Cordic: Max error ${errString}`
        );
        console.debug(
            `\t\t Max Gas: ${max_gas.toString()}, Min Gas: ${min_gas.toString()}`
        );
        expect(max_err.lessThan("1e-17"), "error larger than 1e-17").to.be.true;
    }).timeout(60 * 1000 * 60);

    it("Check random logs in 2^i, i =[0,255], for Cordic", async () => {
        let max_err = new Decimal(0);
        let max_gas = BigNumber.from(0);
        let min_gas = BigNumber.from(ethers.constants.MaxUint256);
        const tasks = [...Array(255).keys()].map(async (i) => {
            const x = Decimal.pow(2, Decimal.random().add(i)).floor();
            const gas = await cordic.estimateGas.log2Times1e18(x.toFixed());
            const raw = await cordic.log2Times1e18(x.toFixed());
            const result = bnToDec(raw).dividedBy("1e18");
            const logx = Decimal.log2(x);
            const err = Decimal.abs(result.minus(logx));
            if (err.greaterThan(max_err)) max_err = err;
            if (gas.gt(max_gas)) max_gas = gas;
            if (gas.lt(min_gas)) min_gas = gas;
        });
        await Promise.all(tasks);
        let errString = max_err.toSignificantDigits(10);
        console.debug(`\t\tRandom Logs of Cordic: Max error ${errString}`);
        console.debug(
            `\t\t Max Gas: ${max_gas.toString()}, Min Gas: ${min_gas.toString()}`
        );
        expect(max_err.lessThan("1e-17"), "error larger than 1e-17").to.be.true;
    }).timeout(60 * 1000 * 60);
});
