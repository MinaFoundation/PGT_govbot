/**
 * Parent class for all errors thrown by the GovBot.
 */
export class GovBotError extends Error {
    public readonly parentError: Error | undefined | unknown;

    constructor(message: string, parentErr?: Error | unknown) {
        super(message);
        this.parentError = parentErr;
    }
}

/**
 * User-oriented errors. These are errors that can can be
 * communicted back to the user.
 */
export class EndUserError extends GovBotError {

}

export class NotFoundEndUserError extends EndUserError {
}


export class EndUserInfo extends GovBotError {
}