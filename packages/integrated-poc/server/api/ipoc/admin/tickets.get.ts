import { listIpocTickets } from "../../../utils/ipocStore";

export default defineEventHandler(() => {
  return {
    tickets: listIpocTickets(),
  };
});
