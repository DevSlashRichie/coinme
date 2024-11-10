import express from "express";
import type { Db } from "mongodb";
import {
  createSecurity,
  getSecurity,
  getOwnerSecurities,
  updateSecurityStatus,
  calculateInterestEarnings,
} from "../../api/security";
import type { State } from "../../state";
import { pae } from "../errors";

function createSecurityReq(db: Db): express.RequestHandler {
  return (req, res): void => {
    const f = async (): Promise<void> => {
      const p = await createSecurity(
        {
          ...req.body,
          createdBy: req.user?.data.id,
        },
        db,
      );

      res.json(p);
    };
    f().catch(pae(res));
  };
}

function getSecurityReq(db: Db): express.RequestHandler {
  return (req, res): void => {
    const f = async (): Promise<void> => {
      res.json(await getSecurity(req.params.securityId as string, db));
    };
    f().catch(pae(res));
  };
}

function getOwnerSecuritiesReq(db: Db): express.RequestHandler {
  return (req, res): void => {
    const f = async (): Promise<void> => {
      res.json(
        await getOwnerSecurities(
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

function updateSecurityStatusReq(db: Db): express.RequestHandler {
  return (req, res): void => {
    const f = async (): Promise<void> => {
      await updateSecurityStatus(
        req.params.securityId as string,
        req.body.status as "active" | "matured" | "cancelled",
        db,
      );
      res.json({ success: true });
    };
    f().catch((e) => {
      res.status(500).json({ error: e });
    });
  };
}

function calculateInterestEarningsReq(db: Db): express.RequestHandler {
  return (req, res): void => {
    const f = async (): Promise<void> => {
      res.json(
        await calculateInterestEarnings(req.params.securityId as string, db),
      );
    };
    f().catch((e) => {
      res.status(500).json({ error: e });
    });
  };
}

export function router(state: State) {
  const router = express.Router();

  // Create new security
  router.post("/", createSecurityReq(state.db));

  // Get specific security
  router.get("/:securityId", getSecurityReq(state.db));

  // Get all securities for an owner
  router.get(
    "/owner/:ownerType/:ownerId/securities",
    getOwnerSecuritiesReq(state.db),
  );

  // Update security status
  router.patch("/:securityId/status", updateSecurityStatusReq(state.db));

  // Calculate interest earnings
  router.get("/:securityId/earnings", calculateInterestEarningsReq(state.db));

  return router;
}
