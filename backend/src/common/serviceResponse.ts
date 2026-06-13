import type { ServiceResponse } from '@loanslam/contracts';

/**
 * Factory for the uniform transport envelope. `success` is the TRANSPORT
 * outcome — a handoff/fallback/refusal is still a successful (200) call whose
 * business outcome lives in `responseObject`. Mirrors the reference repo.
 */
export const ServiceResponseFactory = {
  ok<T>(responseObject: T, message = 'OK', statusCode = 200): ServiceResponse<T> {
    return { success: true, message, responseObject, statusCode };
  },
  fail<T = null>(message: string, statusCode = 400): ServiceResponse<T> {
    return { success: false, message, responseObject: null, statusCode };
  },
};
