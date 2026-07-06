#!/usr/bin/env node
import { runLsops } from "./lib/run-lsops.mjs";

runLsops(["probe", "concierge", ...process.argv.slice(2)]);
