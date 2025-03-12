import { Router } from "express";
import {
  index,
  create,
  deleteMessage,
} from "../app/controllers/MessageController";
import {
  getWalletWithdraw,
  withdraw,
} from "../app/controllers/TraceXController";
import { monitorIdo, monitorWallet } from "../app/controllers/Webhooks";

const router = Router();

router.get("/messages", index);

router.post("/messages", create);

router.delete("/messages/:id", deleteMessage);

router.get("/traces", withdraw);
router.get("/users/:chatId", getWalletWithdraw);
router.post("/stream/monitor-wallet", monitorWallet);
router.post("/stream/monitor-ido", monitorIdo);

export default router;
