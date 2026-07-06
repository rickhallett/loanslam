#!/usr/bin/env node
import { runLsops } from "./lib/run-lsops.mjs";

runLsops(["judge", "concierge-probes", ...process.argv.slice(2)]);
