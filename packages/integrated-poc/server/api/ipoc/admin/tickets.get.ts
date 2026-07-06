import { listIpocAdminTickets } from "../../../domains/ipoc/services/ipocAdmin.service";

export default defineEventHandler(() => {
  return {
    tickets: listIpocAdminTickets(),
  };
});
