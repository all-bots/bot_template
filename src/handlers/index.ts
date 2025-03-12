import registerMenu from "./menu";
import registerAdmin from "./admin";
// import registerLang from "./lang"
import { Telegraf } from "telegraf";
import registerMenuAdmin from "./menuAdmin";

export async function registerHandlers(bot: Telegraf): Promise<Telegraf> {
  //start command handler
  await registerMenu(bot);

  await registerAdmin(bot);

  // await registerLang(bot)

  return bot;
}

export async function registerHandlersAdmin(bot: Telegraf): Promise<Telegraf> {
  //start command handler
  await registerMenuAdmin(bot);

  return bot;
}
