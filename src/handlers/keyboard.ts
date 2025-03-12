import { Keyboard, MakeOptions } from "telegram-keyboard";
import { BTN, CURRENCY } from "../utils/consts";
// import env from "../utils/env";
export const startKeyboard = makeButton([BTN.START]);
export const backKeyboard = makeButton([BTN.BACK]);
export const doneKeyboard = makeButton([BTN.DONE]);
export const menuKeyboard = makeButton([
  BTN.BALANCE,
  BTN.REFERRAL,
  BTN.WITHDRAW,
  BTN.LIST_BUY_IDO_TODAY,
  // BTN.SUPPORT,
  // BTN.BUY,
]);
export const menuAdminKeyboard = makeButton([
  BTN.ON_SEEDING,
  BTN.OFF_SEEDING,
  BTN.CONFIG_TIME_SEEDING,
  BTN.UPDATE_CONTENT_SEEDING,
  BTN.CHECK_WITHDRAW,
  BTN.SEND_WITHDRAW,
  BTN.ENABLE_WITHDRAW,
  BTN.DISABLE_WITHDRAW,
  BTN.CHECK_USER,
  BTN.CHECK_ADDRESS,
  BTN.CHECK_ALL,
  BTN.SET_TIME_FORWARD,
  BTN.LOCK,
  BTN.UNLOCK,
  BTN.CONFIG_SWAP,
]);

export const minePackageKeyboard = makeButton([
  "$10",
  "$100",
  "$1.000",
  "$10.000",
  "$100.000",
  // BTN.OTHER,
]);

export const currencyKeyboard = makeButton([
  CURRENCY.ETH,
  CURRENCY.BNB,
  CURRENCY.USDT_ERC20,
  CURRENCY.USDT_BEP20,
  CURRENCY.BUSD,
]);

export const currencyWithdrawKeyboard = makeButton([
  CURRENCY.BNB,
  CURRENCY.USDT_BEP20,
]);

export function makeButton(
  buttons: string[],
  options = {
    columns: 2,
  } as MakeOptions,
) {
  return Keyboard.make(buttons, options);
}
