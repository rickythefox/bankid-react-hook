export enum LoginStatus {
  None,
  Starting,
  Polling,
  UserSign,
  Complete,
  Failed,
}

export type Fetcher = (url: string) => Promise<any>;
