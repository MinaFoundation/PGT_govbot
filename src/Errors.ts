/**
 * Parent class for all errors thrown by the GovBot.
 */
export class GovBotError extends Error {
}

/**
 * User-oriented errors. These are errors that can can be
 * communicted back to the user.
 */
export class EndUserError extends GovBotError {
}
