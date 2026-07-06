#!/usr/bin/env node
import { runLsops } from "./lib/run-lsops.mjs";

runLsops(["proof", "run", "seam-walk", ...process.argv.slice(2)]);
