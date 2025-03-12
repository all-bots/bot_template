import "dotenv/config";
import { Telegraf, Context } from "telegraf";
import env from "./utils/env";
import { registerHandlers } from "./handlers";
import rateLimit from "telegraf-ratelimit";
import { createInstance as initCacheInstance } from "./utils/cache";
import { attachUser } from "./middlewares/attachUser";

import Moralis from "moralis";
import { initQueue } from "./utils/redis";

// Set limit to 1 message per 3 seconds
const limitConfig = {
  window: 3000,
  limit: 1,
  onLimitExceeded: (ctx: any) => {
    // ctx.reply("Too fast")
  },
};

export async function main() {
  await initQueue();
  await Moralis.start({ apiKey: env.MORALIS_API_KEY });

  let bot = new Telegraf(env.BOT_TOKEN);
  //init cache
  initCacheInstance();
  //rate limit
  bot.use(rateLimit(limitConfig));
  //attach user
  bot.use(attachUser);
  bot.catch((err: any, ctx: Context) => {
    console.log(`Ooops, encountered an error for ${ctx.updateType}`, err);
  });
  await registerHandlers(bot);
  bot.launch();

  console.log("bot started! ", new Date().toISOString());
}

try {
  main();
} catch (error) {
  console.log(error);
}
