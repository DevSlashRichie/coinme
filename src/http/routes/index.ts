import express from "express";

// routes
import { authMiddleware, router as authRouter } from "../authentication";
import { router as businesRouter } from "./business";
import { router as transactionRouter } from "./transaction";
import { router as securityRouter } from "./security";
import { router as loanRouter } from "./loan";

import type { State } from "../../state";

export function routes(state: State) {
  const router = express.Router();

  const admin = express.Router();

  admin.use(authMiddleware(true));
  admin.use("/business", businesRouter(state));
  admin.use("/transaction", transactionRouter(state));
  admin.use("/security", securityRouter(state));
  admin.use("/loan", loanRouter(state));

  const pb = express.Router();

  const user = express.Router();
  user.use(authMiddleware());

  router.use("/auth", authRouter(state));
  router.use("/user", user);
  router.use("/public", pb);
  router.use("/admin", admin);

  return router;
}
