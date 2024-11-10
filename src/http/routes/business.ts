import express from "express";
import type { Db } from "mongodb";
import {
  addBusinessMember,
  createBusiness,
  getBusiness,
} from "../../api/bussiness";
import type { State } from "../../state";

function createBusinessReq(db: Db): express.RequestHandler {
  return (req, res): void => {
    const f = async (): Promise<void> => {
      res.json(
        await createBusiness(
          {
            ...req.body,
            userAdminId: req.body.userAdminId || req.user?.data.id,
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

function getBusinessReq(db: Db): express.RequestHandler {
  return (req, res): void => {
    const f = async (): Promise<void> => {
      res.json(await getBusiness(req.params.businessId as string, db));
    };

    f().catch((e) => {
      res.status(500).json({ error: e });
    });
  };
}

function addMemberToBusinessReq(db: Db): express.RequestHandler {
  return (req, res): void => {
    const f = async (): Promise<void> => {
      res.json(
        await addBusinessMember(
          {
            businessId: req.params.businessId,
            userId: req.body.userId,
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

export function router(state: State) {
  const router = express.Router();

  router.post("/", createBusinessReq(state.db));
  router.get("/:businessId", getBusinessReq(state.db));
  router.post("/:businessId/add_member", addMemberToBusinessReq(state.db));

  return router;
}
