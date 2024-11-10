import express from "express";
import type { Db } from "mongodb";
import {
  createTransaction,
  getTransaction,
  getOwnerTransactions,
  getOwnerBalance,
} from "../../api/transaction";
import type { State } from "../../state";

function createTransactionReq(db: Db): express.RequestHandler {
  return (req, res): void => {
    const f = async (): Promise<void> => {
      res.json(
        await createTransaction(
          {
            ...req.body,
            createdBy: req.user?.data.id,
          },
          db,
        ),
      );
    };
    f().catch((e) => {
      res.status(500).json({ error: e });
    });
  };
}

function getTransactionReq(db: Db): express.RequestHandler {
  return (req, res): void => {
    const f = async (): Promise<void> => {
      res.json(await getTransaction(req.params.transactionId as string, db));
    };
    f().catch((e) => {
      res.status(500).json({ error: e });
    });
  };
}

function getOwnerTransactionsReq(db: Db): express.RequestHandler {
  return (req, res): void => {
    const f = async (): Promise<void> => {
      res.json(
        await getOwnerTransactions(
          req.params.ownerId as string,
          req.params.ownerType as "user" | "business",
          db,
        ),
      );
    };
    f().catch((e) => {
      res.status(500).json({ error: e });
    });
  };
}

function getOwnerBalanceReq(db: Db): express.RequestHandler {
  return (req, res): void => {
    const f = async (): Promise<void> => {
      res.json({
        balance: await getOwnerBalance(
          req.params.ownerId as string,
          req.params.ownerType as "user" | "business",
          db,
        ),
      });
    };
    f().catch((e) => {
      res.status(500).json({ error: e });
    });
  };
}

export function router(state: State) {
  const router = express.Router();

  // Create new transaction
  router.post("/", createTransactionReq(state.db));

  // Get specific transaction
  router.get("/:transactionId", getTransactionReq(state.db));

  // Get all transactions for an owner
  router.get(
    "/owner/:ownerType/:ownerId/transactions",
    getOwnerTransactionsReq(state.db),
  );

  // Get balance for an owner
  router.get(
    "/owner/:ownerType/:ownerId/balance",
    getOwnerBalanceReq(state.db),
  );

  return router;
}
