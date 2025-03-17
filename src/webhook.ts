import { Telegraf } from "telegraf";
import express from "express";
import "dotenv/config";
import { Scenes } from "telegraf";

import env from "./utils/env";

// Tạo bot
const bot = new Telegraf(env.BOT_TOKEN);
function flow() {
  const stepHandler = new Scenes.WizardScene(
    "my_wizard",
    async (ctx: any) => {
      await ctx.reply("Bước 1: Nhập thông tin của bạn.");
      return ctx.wizard.next(); // Chuyển sang bước tiếp theo
    },
    async (ctx: any) => {
      await ctx.reply("Bước 2: Cảm ơn bạn đã nhập thông tin!");
      return ctx.scene.leave(); // Kết thúc wizard
    },
  );
  return stepHandler;
}
// Cấu hình Stage và Scene
const stage = new Scenes.Stage([flow()]);

// Cấu hình Express để nhận webhook từ Telegram
const app = express();

// Cấu hình webhook
app.use(express.json()); // Để xử lý dữ liệu POST từ Telegram
app.post(
  "/webhook",
  bot.webhookCallback("/webhook"),
  //   (req, res) => {
  //   bot.handleUpdate(req.body, res); // Xử lý update từ Telegram

  //   res.sendStatus(200); // Đáp lại Telegram với mã 200 để xác nhận
  // }
);

// Cấu hình webhook với Telegraf
bot.telegram.setWebhook("https://yourdomain.com/webhook"); // URL của webhook

// Khởi động Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Khởi động bot với middleware
bot.use(stage.middleware());
