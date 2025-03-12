import { startKeyboard } from "../handlers/keyboard";

import captchagen from "captchagen";
import { CodeStatus, PrismaClient } from "@prisma/client";
import { getCurrentDate } from "../utils";

import * as svgCaptcha from "svg-captcha";
// import { convert } from "convert-svg-to-png";
import svg2png from "svg2png";

export const genCaptchaSvg = async () => {
  const svg = svgCaptcha.createMathExpr({
    mathMin: 1,
    mathMax: 9,
    mathOperator: "+",
    width: 200,
    color: true,
  });
  return {
    value: svg.text,
    image: { source: svg2png.sync(svg.data) },
    imageValue: "base64fromSVG",
  };
};

export const genCaptcha = async () => {
  let captcha = captchagen.create();
  captcha.generate();
  return {
    value: captcha.text(),
    image: { source: Buffer.from(captcha.uri().substring(22), "base64") },
    imageValue: captcha.uri().substring(22),
  };
};

// export const genCaptcha = async () => {
//   // const genCaptcha = () => {
//   const cap = captcha();
//   return {
//     value: cap.value,
//     image: { source: Buffer.from(cap.image.substr(23), "base64") },
//     imageValue: cap.image.substr(23),
//   };
//   // }
// };
async function getCodeSend(prisma: PrismaClient, ctx: any) {
  let date = getCurrentDate();
  let code = await prisma.code.findFirst({
    where: {
      userId: ctx.user.id,
      date,
      status: CodeStatus.PENDING,
    },
  });

  if (!code) {
    const newCaptcha = await genCaptcha();
    code = await prisma.code.create({
      data: {
        userId: ctx.user.id,
        code: newCaptcha.value,
        image: newCaptcha.imageValue,
        date: getCurrentDate(),
      },
    });
  }
  return {
    code: code.code,
    image: code.image,
  };
}

export async function sendCode(prisma: PrismaClient, ctx: any) {
  const code = await getCodeSend(prisma, ctx);
  ctx.scene.state.captcha = code.code;
  await ctx.reply(
    "🔐 Enter the captcha below to proceed",
    startKeyboard.remove(),
  );
  await ctx.replyWithPhoto({ source: Buffer.from(code.image, "base64") });
}
