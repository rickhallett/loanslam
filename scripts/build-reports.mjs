#!/usr/bin/env node
import { runLsops } from "./lib/run-lsops.mjs";

runLsops(["reports", "build", ...process.argv.slice(2)]);
