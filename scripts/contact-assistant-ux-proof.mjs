#!/usr/bin/env node
import { runLsops } from "./lib/run-lsops.mjs";

runLsops(["proof", "run", "contact-assistant", ...process.argv.slice(2)]);
