import { ObjectId, type Db } from "mongodb";
import { z } from "zod";
import { ObjectIdZod } from "./common";

export interface Loan {
    _id: ObjectId;
    borrower: {
        type: "user" | "business";
        id: ObjectId;
    };
    principalAmount: number; // Original loan amount
    interestRate: number; // Annual interest rate as decimal
    termMonths: number; // Loan duration in months
    startDate: Date;
    endDate: Date; // Calculated from startDate + termMonths
    paymentFrequency: "weekly" | "biweekly" | "monthly";
    paymentAmount: number; // Calculated monthly payment amount
    status: "pending" | "active" | "paid" | "defaulted" | "rejected";
    remainingBalance: number; // Current amount still owed
    nextPaymentDue: Date;
    paymentHistory: {
        date: Date;
        amount: number;
        type: "principal" | "interest";
    }[];
    createdBy: ObjectId;
    createdAt: Date;
}

const CreateLoanZod = z.object({
    borrower: z.object({
        type: z.enum(["user", "business"]),
        id: ObjectIdZod,
    }),
    principalAmount: z.number().positive(),
    interestRate: z.number().min(0).max(1),
    termMonths: z.number().positive().int(),
    startDate: z.coerce.date(),
    paymentFrequency: z.enum(["weekly", "biweekly", "monthly"]),
    createdBy: ObjectIdZod,
});

export type CreateLoanType = z.infer<typeof CreateLoanZod>;

// Calculate monthly payment amount using amortization formula
function calculateMonthlyPayment(
    principal: number,
    annualRate: number,
    termMonths: number,
): number {
    const monthlyRate = annualRate / 12;
    return (
        (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
        (Math.pow(1 + monthlyRate, termMonths) - 1)
    );
}

export async function createLoan(
    create: CreateLoanType,
    db: Db,
): Promise<Loan> {
    const cl = db.collection<Loan>("loans");
    const data = await CreateLoanZod.parseAsync(create);

    const endDate = new Date(create.startDate);
    endDate.setMonth(endDate.getMonth() + create.termMonths);

    const monthlyPayment = calculateMonthlyPayment(
        create.principalAmount,
        create.interestRate,
        create.termMonths,
    );

    const nextPaymentDue = new Date(create.startDate);
    switch (create.paymentFrequency) {
        case "weekly":
            nextPaymentDue.setDate(nextPaymentDue.getDate() + 7);
            break;
        case "biweekly":
            nextPaymentDue.setDate(nextPaymentDue.getDate() + 14);
            break;
        case "monthly":
            nextPaymentDue.setMonth(nextPaymentDue.getMonth() + 1);
            break;
    }

    const loan: Omit<Loan, "_id"> = {
        ...data,
        endDate,
        paymentAmount: Math.round(monthlyPayment),
        status: "active",
        remainingBalance: Math.round(create.principalAmount),
        nextPaymentDue,
        paymentHistory: [],
        createdAt: new Date(),
    };

    const r = await cl.insertOne(loan as Loan);
    return { ...loan, _id: r.insertedId };
}

export async function getLoan(input: string, db: Db): Promise<Loan | null> {
    const cl = db.collection<Loan>("loans");
    const id = await ObjectIdZod.parseAsync(input);
    return cl.findOne({ _id: id });
}

export async function getBorrowerLoans(
    borrowerId: string,
    borrowerType: "user" | "business",
    db: Db,
): Promise<Loan[]> {
    const cl = db.collection<Loan>("loans");
    const id = await ObjectIdZod.parseAsync(borrowerId);
    return cl
        .find({
            "borrower.id": id,
            "borrower.type": borrowerType,
        })
        .toArray();
}

const MakePaymentZod = z.object({
    loanId: ObjectIdZod,
    amount: z.number().positive(),
});

export async function makePayment(
    input: { loanId: string; amount: number },
    db: Db,
): Promise<void> {
    const cl = db.collection<Loan>("loans");
    const data = await MakePaymentZod.parseAsync(input);
    const loan = await getLoan(data.loanId.toString(), db);

    if (!loan) throw new Error("Loan not found");
    if (loan.status !== "active") throw new Error("Loan is not active");

    if (data.amount > loan.remainingBalance) {
        throw new Error("Payment amount exceeds remaining balance");
    }

    const monthlyInterest = loan.remainingBalance * (loan.interestRate / 12);
    const principalPayment = Math.min(
        data.amount - monthlyInterest,
        loan.remainingBalance,
    );
    const interestPayment = data.amount - principalPayment;

    const newBalance = loan.remainingBalance - principalPayment;
    const newNextPaymentDue = new Date(loan.nextPaymentDue);

    switch (loan.paymentFrequency) {
        case "weekly":
            newNextPaymentDue.setDate(newNextPaymentDue.getDate() + 7);
            break;
        case "biweekly":
            newNextPaymentDue.setDate(newNextPaymentDue.getDate() + 14);
            break;
        case "monthly":
            newNextPaymentDue.setMonth(newNextPaymentDue.getMonth() + 1);
            break;
    }

    const result = await cl.findOneAndUpdate(
        { _id: data.loanId },
        {
            $set: {
                remainingBalance: Math.round(newBalance),
                nextPaymentDue: newNextPaymentDue,
                status: newBalance <= 0 ? "paid" : "active",
            },
            $push: {
                paymentHistory: {
                    date: new Date(),
                    amount: Math.round(data.amount),
                    type: principalPayment > interestPayment ? "principal" : "interest",
                },
            },
        },
    );

    if (result) {
        const remainingBalIsZero = result.remainingBalance = 0;

        if (remainingBalIsZero) {
            await updateLoanStatus(data.loanId.toHexString(), "paid", db);
        }
    }
}

export async function updateLoanStatus(
    loanId: string,
    status: "active" | "paid" | "defaulted" | "rejected",
    db: Db,
): Promise<void> {
    const cl = db.collection<Loan>("loans");
    const id = await ObjectIdZod.parseAsync(loanId);
    await cl.updateOne({ _id: id }, { $set: { status } });
}
