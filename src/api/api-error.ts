type ApiErrorType = "invalid_request" | "internal_error" | "entity_not_found";

export class ApiError extends Error {
    constructor(
        message: string,
        private readonly type: ApiErrorType,
    ) {
        super(message);
    }

    get httpCode(): number {
        switch (this.type) {
            case "invalid_request":
                return 400;
            case "entity_not_found":
                return 404;
            case "internal_error":
            default:
                return 500;
        }
    }

    get message(): string {
        switch (this.type) {
            case "invalid_request":
                return this.message;
            case "entity_not_found":
                return `${this.message} not fue encontrado.`;
            case "internal_error":
            default:
                return `Error del Servidor: ${this.message}`;
        }
    }
}
