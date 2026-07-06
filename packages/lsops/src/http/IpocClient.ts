import { JsonClient } from "./JsonClient";

export class IpocClient {
  readonly json: JsonClient;

  constructor(baseUrl: string, options: { fetchImpl?: typeof fetch } = {}) {
    this.json = new JsonClient(
      options.fetchImpl
        ? { baseUrl, fetchImpl: options.fetchImpl }
        : { baseUrl },
    );
  }
}
