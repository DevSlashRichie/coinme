import argon2, { argon2id } from "argon2";
import { ObjectId, type Db } from "mongodb";
import * as jose from "jose";
import type { State } from "../state";

export interface User {
    _id: ObjectId;
    phone: string;
    email?: string;

    admin?: boolean;

    name?: string;
    birthday?: Date;
    gender?: string;
}

export type CreateUser = Omit<User, "_id"> & {
    password?: string;
};

export interface AssertUser {
    phone: string;
    email?: string;
}

export interface AuthUser {
    id: string;
    password: string;
}

export interface LoggedUser {
    token: string;
}

export async function createUser(create: CreateUser, db: Db): Promise<User> {
    const cl = db.collection("users");

    let pass: null | string = null;

    // in case a password is set then we hash it
    if (create.password) {
        const hash = await argon2.hash(create.password, {
            type: argon2id,
        });

        pass = hash;
    }

    // save the user to the database

    const r = await cl.insertOne({
        hash: pass,
        phone: create.phone,
        email: create.email,
        name: create.name,
        birthday: create.birthday,
        gender: create.gender,
    });

    return {
        _id: r.insertedId,
        phone: create.phone,
        email: create.email,
        name: create.name,
        birthday: create.birthday,
        gender: create.gender,
    };
}

export async function authUser(data: AuthUser, db: Db): Promise<LoggedUser> {
    const cl = db.collection("users");

    const user = await cl.findOne<User & { hash: string }>({
        $or: [{ phone: data.id }, { email: data.id }],
    });

    if (!user) {
        throw new Error("User not found");
    }

    const isValid = await argon2.verify(user.hash, data.password);

    if (!isValid) {
        throw new Error("Invalid password");
    }

    const token = await new jose.SignJWT({
        aud: "coinme",
        // in 1 month
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
        iat: Math.floor(Date.now() / 1000),
        iss: "coinme",
        nbf: Math.floor(Date.now() / 1000),
        sub: user._id.toHexString(),
        data: {
            isAdmin: user.admin ?? false,
            name: user.name,
        },
    })
        .setProtectedHeader({ alg: "HS256" })
        .sign(Buffer.from("secret"));

    return {
        token,
    };
}

export async function renewToken(token: string, db: Db): Promise<LoggedUser> {
    const { payload } = await jose.jwtVerify<VerifiedToken>(
        token,
        Buffer.from("secret"),
    );

    const cl = db.collection("users");

    const user = await cl.findOne<User>({
        _id: new ObjectId(payload.sub),
    });

    if (!user) {
        throw new Error("User not found");
    }

    const newToken = await new jose.SignJWT({
        aud: "sd",
        // in 1 month
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
        iat: Math.floor(Date.now() / 1000),
        iss: "sd-doctor",
        nbf: Math.floor(Date.now() / 1000),
        sub: user._id.toHexString(),
        data: {
            isAdmin: user.admin ?? false,
            name: user.name,
            birthday: user.birthday,
            gender: user.gender,
        },
    })
        .setProtectedHeader({ alg: "HS256" })
        .sign(Buffer.from("secret"));

    return {
        token: newToken,
    };
}

export async function assertUser(
    assertion: AssertUser,
    state: DoctorState,
): Promise<User> {
    const cl = state.db.collection("users");

    const tryFind = await cl.findOne<User>({
        $or: [{ phone: assertion.phone }, { email: assertion.email }],
    });

    if (tryFind) {
        return {
            _id: tryFind._id,
            phone: tryFind.phone,
            email: tryFind.email,
        };
    }

    return await createUser(
        {
            phone: assertion.phone,
            email: assertion.email,
            password: "",
        },
        state.db,
    );
}

export async function getUser(
    id: ObjectId,
    state: State,
): Promise<User | null> {
    const cl = state.db.collection("users");

    return await cl.findOne<User>({
        _id: id,
    });
}

export async function claimUserWithPassword(
    niceId: string,
    password: string,
    state: State,
): Promise<User> {
    const cl = state.db.collection("users");

    const user = await cl.findOne<User & { hash: string }>({
        $or: [{ phone: niceId }, { email: niceId }],
    });

    if (!user) {
        throw new Error("User not found");
    }

    // then we create the hash for the new password

    const hash = await argon2.hash(password, {
        type: argon2id,
    });

    // then we update the user with the new password
    const updated = await cl.findOneAndUpdate(
        {
            _id: user._id,
        },
        {
            $set: {
                hash,
            },
        },
        {
            returnDocument: "after",
        },
    );

    if (!updated) {
        throw new Error("User not found");
    }

    return {
        _id: updated._id,
        phone: updated.phone,
        email: updated.email,
    };
}

export interface VerifiedToken extends jose.JWTPayload {
    data: {
        id: ObjectId;
        isAdmin: boolean;
    };
}

export async function verifyUserToken(token: string): Promise<VerifiedToken> {
    const { payload } = await jose.jwtVerify<VerifiedToken>(
        token,
        Buffer.from("secret"),
    );

    return {
        ...payload,
        data: {
            id: new ObjectId(payload.sub),
            isAdmin: payload.data.isAdmin,
        },
    };
}
