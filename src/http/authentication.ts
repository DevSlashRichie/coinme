import express from "express";
import type { Db } from "mongodb";
import {
  authUser,
  createUser,
  renewToken,
  verifyUserToken,
  type VerifiedToken,
} from "../api/users";
import { z } from "zod";
import type { State } from "../state";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: VerifiedToken;
    }
  }
}

function createUserReq(db: Db): express.RequestHandler {
  return (req, res): void => {
    const f = async (): Promise<void> => {
      const schema = z.object({
        phone: z
          .string()
          .min(10)
          .startsWith("+")
          .regex(/^\+\d+$/),
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string(),
      });

      const payload = await schema.safeParseAsync(req.body);

      if (!payload.success) {
        res.status(400).json({ error: payload.error });
        return;
      }

      res.json(await createUser(payload.data, db));
    };

    f().catch((e) => {
      res.status(500).json({ error: e.message });
    });
  };
}

function authUserReq(db: Db): express.RequestHandler {
  return (req, res): void => {
    const f = async (): Promise<void> => {
      const schema = z.object({
        id: z.string(),
        password: z.string(),
      });

      const payload = await schema.safeParseAsync(req.body);

      if (!payload.success) {
        res.status(400).json({ message: payload.error });
        return;
      }

      res.json(await authUser(payload.data, db));
    };

    f().catch((e) => {
      res.status(500).json({ error: e.message });
    });
  };
}

function renewTokenReq(state: State): express.RequestHandler {
  return (req, res): void => {
    const f = async (): Promise<void> => {
      const token = req.headers.authorization?.split("Bearer ")[1];

      if (!token) {
        res.status(400).json({ error: "No token provided" });
        return;
      }

      renewToken(token, state.db)
        .then((user) => {
          res.status(202).json({ token: user.token });
        })
        .catch((err) => {
          res.status(401).json({ error: "Unauthorized: " + String(err) });
        });
    };

    f().catch((e) => {
      res.status(500).json({ error: e.message });
    });
  };
}

export function authMiddleware(withAdmin = false): express.RequestHandler {
  return (req, res, next): void => {
    const completeToken = req.headers.authorization;

    if (!completeToken) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const token = completeToken.split("Bearer ")[1];

    verifyUserToken(token)
      .then((user) => {
        // if (withAdmin && !user.data.isAdmin)
        //   throw new Error("Unauthorized: User is not an admin");

        req.user = user;
        next();
      })
      .catch((err) => {
        res.status(401).json({ error: "Unauthorized: " + String(err) });
      });
  };
}

export function router(state: State): express.Router {
  const router = express.Router();

  router.post("/create", createUserReq(state.db));
  router.post("/login", authUserReq(state.db));
  router.post("/renew", renewTokenReq(state));

  return router;
}
