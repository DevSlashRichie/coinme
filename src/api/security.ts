import { ObjectId, type Db } from "mongodb";
import { z } from "zod";
import { DateAsString, ObjectIdZod } from "./common";
import { ApiError } from "./api-error";

export interface Security {
    _id: ObjectId;
    owner: {
        type: "user" | "business";
        id: ObjectId;
    };
    name: string;

    cost: number; // Purchase price of the security
    amount: number; // Number of securities purchased

    interestRate: number; // Annual interest rate as decimal (e.g., 0.05 for 5%)
    startDate: Date; // When the investment begins
    maturityDate: Date | null; // When the investment ends
    paymentFrequency: "monthly" | "quarterly" | "annually"; // How often interest is paid
    status: "active" | "matured" | "cancelled";
    createdBy: ObjectId;
    createdAt: Date;
}

const CreateSecurityZod = z.object({
    owner: z.object({
        type: z.enum(["user", "business"]),
        id: ObjectIdZod,
    }),
    name: z.string().min(1),

    cost: z.number().min(1),
    amount: z.number().min(1),

    interestRate: z.number().min(0).max(1), // Between 0 and 1 (0% to 100%)
    startDate: z.coerce.date(),
    maturityDate: DateAsString,
    paymentFrequency: z.enum(["monthly", "quarterly", "annually"]),
    createdBy: ObjectIdZod,
});

export type CreateSecurityType = z.infer<typeof CreateSecurityZod>;

export async function createSecurity(
    create: CreateSecurityType,
    db: Db,
): Promise<Security> {
    const cl = db.collection<Security>("securities");

    const data = await CreateSecurityZod.parseAsync(create);

    // Validate that maturity date is after start date
    if (data.maturityDate && data.maturityDate <= data.startDate) {
        throw new ApiError(
            "Maturity date must be after start date",
            "invalid_request",
        );
    }

    const r = await cl.insertOne({
        _id: new ObjectId(),
        ...data,
        status: "active",
        createdAt: new Date(),
    });

    return {
        _id: r.insertedId,
        ...data,
        status: "active",
        createdAt: new Date(),
    };
}

export async function getSecurity(
    input: string,
    db: Db,
): Promise<Security | null> {
    const cl = db.collection<Security>("securities");
    const id = await ObjectIdZod.parseAsync(input);
    return cl.findOne({ _id: id });
}

export async function getOwnerSecurities(
    ownerId: string,
    ownerType: "user" | "business",
    db: Db,
): Promise<Security[]> {
    const cl = db.collection<Security>("securities");
    const id = await ObjectIdZod.parseAsync(ownerId);
    return cl
        .find({
            "owner.id": id,
            "owner.type": ownerType,
        })
        .toArray();
}

export async function updateSecurityStatus(
    securityId: string,
    status: "active" | "matured" | "cancelled",
    db: Db,
): Promise<void> {
    const cl = db.collection<Security>("securities");
    const id = await ObjectIdZod.parseAsync(securityId);
    await cl.updateOne({ _id: id }, { $set: { status } });
}

// Calculate expected interest earnings for a security
export async function calculateInterestEarnings(
    securityId: string,
    db: Db,
): Promise<{
    totalInterest: number;
    nextPaymentDate: Date | null;
    remainingPayments: number | null;
}> {
    const security = await getSecurity(securityId, db);
    if (!security) throw new Error("Security not found");

    const upperDate = security.maturityDate || new Date();

    const totalDays = upperDate.getTime() - security.startDate.getTime();
    const daysPerYear = 365;
    const yearsToMaturity = totalDays / (daysPerYear * 24 * 60 * 60 * 1000);

    const principalAmount = security.cost * security.amount;
    const totalInterest =
        principalAmount * security.interestRate * yearsToMaturity;

    // Calculate next payment date
    const now = new Date();
    let nextPaymentDate: Date | null = new Date(security.startDate);
    const paymentIntervals = {
        monthly: 1,
        quarterly: 3,
        annually: 12,
    };

    while (nextPaymentDate <= now) {
        nextPaymentDate.setMonth(
            nextPaymentDate.getMonth() + paymentIntervals[security.paymentFrequency],
        );
    }

    if (nextPaymentDate >= upperDate) {
        nextPaymentDate = null;
    }

    // Calculate remaining payments
    const remainingTime = security.maturityDate
        ? security.maturityDate.getTime() - now.getTime()
        : null;
    const remainingYears =
        remainingTime === null
            ? null
            : remainingTime / (daysPerYear * 24 * 60 * 60 * 1000);

    const paymentsPerYear = {
        monthly: 12,
        quarterly: 4,
        annually: 1,
    };
    const remainingPayments = remainingYears
        ? Math.ceil(remainingYears * paymentsPerYear[security.paymentFrequency])
        : null;

    return {
        totalInterest: Math.round(totalInterest),
        nextPaymentDate,
        remainingPayments,
    };
}
