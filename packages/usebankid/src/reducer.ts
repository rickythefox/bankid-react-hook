import { Status } from "./types";

export enum ActionType {
  StartLogin = "StartLogin",
  ContinueLogin = "ContinueLogin",
  UpdateAuthenticationData = "UpdateAuthenticationData",
  UpdateIntervalIds = "UpdateIntervalIds",
  UpdateQr = "UpdateQr",
  ResetQr = "ResetQr",
  UpdateLoginStatus = "UpdateLoginStatus",
  UpdateUserData = "UpdateUserData",
  Error = "Error",
  CancelLogin = "CancelLogin",
  Reset = "Reset",
}

type State = {
  status: Status;
  orderRef?: string;
  qr?: string;
  userData?: any;
  autoStartToken?: string;
  error?: any;
  errorMessage?: string;
  token?: string;
  collectInterval?: any;
  qrInterval?: any;
};

type Action =
  | { type: ActionType.StartLogin }
  | { type: ActionType.ContinueLogin; orderRef: string }
  | { type: ActionType.UpdateAuthenticationData; autoStartToken: string; orderRef: string; qr: string }
  | { type: ActionType.UpdateIntervalIds; collectInterval?: any; qrInterval?: any }
  | { type: ActionType.UpdateQr; qr: string }
  | { type: ActionType.ResetQr }
  | { type: ActionType.UpdateLoginStatus; status: Status }
  | { type: ActionType.UpdateUserData; data: any; token: any }
  | { type: ActionType.Error; error: any; errorMessage: string }
  | { type: ActionType.CancelLogin }
  | { type: ActionType.Reset };

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case ActionType.StartLogin:
      return { status: Status.Starting };
    case ActionType.ContinueLogin:
      return { status: Status.Continuing, orderRef: action.orderRef };
    case ActionType.UpdateAuthenticationData:
      return {
        ...state,
        status: Status.Started,
        autoStartToken: action.autoStartToken,
        orderRef: action.orderRef,
        qr: action.qr,
      };
    case ActionType.UpdateIntervalIds:
      return {
        ...state,
        status: Status.Polling,
        collectInterval: action.collectInterval,
        qrInterval: action.qrInterval,
      };
    case ActionType.UpdateQr:
      if (state.status !== Status.Polling) return state;
      return { ...state, qr: action.qr };
    case ActionType.ResetQr:
      return { ...state, qr: undefined };
    case ActionType.UpdateLoginStatus:
      return {
        ...state,
        status: action.status,
        qr: [Status.UserSign, Status.Cancelled].includes(action.status) ? undefined : state.qr,
      };
    case ActionType.UpdateUserData:
      return {
        ...state,
        status: Status.Complete,
        userData: { ...action.data, token: action.token },
        token: action.token,
      };
    case ActionType.Error:
      return {
        ...state,
        status: Status.Failed,
        error: action.error,
        errorMessage: action.errorMessage,
      };
    case ActionType.CancelLogin:
      return { ...state, status: Status.Cancelling };
    case ActionType.Reset:
      return { status: Status.None };
  }
}
