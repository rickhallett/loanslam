import { listIpocTickets } from "../../../domains/ipoc/stores/ipocSession.store";

export default defineEventHandler(() => {
  return {
    tickets: listIpocTickets(),
  };
});
