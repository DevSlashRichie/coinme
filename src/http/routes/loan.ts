import express from "express";
import type { Db } from "mongodb";
import {
  createLoan,
  getLoan,
  getBorrowerLoans,
  makePayment,
  updateLoanStatus,
} from "../../api/loan";
import type { State } from "../../state";
import { pae } from "../errors";

function createLoanReq(db: Db): express.RequestHandler {
  return (req, res): void => {
    const f = async (): Promise<void> => {
      res.json(
        await createLoan(
          {
            ...req.body,
            createdBy: req.user?.data.id,
          },
          db,
        ),
      );
    };
    f().catch(pae(res));
  };
}

function getLoanReq(db: Db): express.RequestHandler {
  return (req, res): void => {
    const f = async (): Promise<void> => {
      res.json(await getLoan(req.params.loanId as string, db));
    };
    f().catch(pae(res));
  };
}

function getBorrowerLoansReq(db: Db): express.RequestHandler {
  return (req, res): void => {
    const f = async (): Promise<void> => {
      res.json(
        await getBorrowerLoans(
          req.params.borrowerId as string,
          req.params.borrowerType as "user" | "business",
          db,
        ),
      );
    };
    f().catch((e) => {
      res.status(500).json({ error: e });
    });
  };
}

function makePaymentReq(db: Db): express.RequestHandler {
  return (req, res): void => {
    const f = async (): Promise<void> => {
      await makePayment(
        {
          loanId: req.params.loanId,
          amount: req.body.amount,
        },
        db,
      );
      res.json({ success: true });
    };
    f().catch(pae(res));
  };
}

function updateLoanStatusReq(db: Db): express.RequestHandler {
  return (req, res): void => {
    const f = async (): Promise<void> => {
      await updateLoanStatus(
        req.params.loanId as string,
        req.body.status as "active" | "paid" | "defaulted" | "rejected",
        db,
      );
      res.json({ success: true });
    };
    f().catch(pae(res));
  };
}

export function router(state: State) {
  const router = express.Router();

  // Create new loan
  router.post("/", createLoanReq(state.db));

  // Get specific loan
  router.get("/:loanId", getLoanReq(state.db));

  // Get all loans for a borrower
  router.get(
    "/borrower/:borrowerType/:borrowerId",
    getBorrowerLoansReq(state.db),
  );

  // Make a payment on a loan
  router.post("/:loanId/payment", makePaymentReq(state.db));

  // Update loan status
  router.patch("/:loanId/status", updateLoanStatusReq(state.db));

  return router;
}
