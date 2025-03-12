import "dotenv/config";
import express from "express";
import { create } from "express-handlebars";

import path from "path";

import router from "./routes";

const app = express();
app.use(
  express.urlencoded({
    extended: true,
  }),
);
app.use(express.json());
console.log(path.join(__dirname, "../public"));
app.use(express.static(path.join(__dirname, "../public")));
app.engine(
  ".hbs",
  create({
    extname: ".hbs",
    layoutsDir: path.join(__dirname, "../src/resources/views/layouts"),
    partialsDir: path.join(__dirname, "../src/resources/views"),
  }).engine,
);
app.set("view engine", ".hbs");
app.set("views", path.join(__dirname, "../src/resources/views"));

const PORT = 9000;

app.use(router);

app.listen(PORT, () => {
  console.log(`App listening at ${PORT}`, new Date().toISOString());
});
