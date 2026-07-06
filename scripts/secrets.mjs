#!/usr/bin/env node
import { runLsops } from "./lib/run-lsops.mjs";

runLsops(["secrets", ...process.argv.slice(2)]);
