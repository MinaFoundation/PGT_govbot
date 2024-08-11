import { Message } from "discord.js";
import { TrackedInteraction } from "../core/BaseClasses";
import { EndUserError, EndUserInfo, GovBotError } from "../Errors";
import logger from "../logging";


export class DiscordStatus {

    public static async handleException(interaction: TrackedInteraction, exception: unknown): Promise<void> {
         if (exception instanceof EndUserInfo) {
            await DiscordStatus.Info.info(interaction, exception.message);
        } else {
            await this.Error.handleError(interaction, exception);
        }
    }
    

    public static Error = {
        DEFAULT_ERROR_MESSAGE: 'Oops! There\'s been an error while processing your request. Please contact support.',

        buildMessageForError(error: Error | undefined | unknown): string {
            return error instanceof EndUserError ? `${error.message}` : this.DEFAULT_ERROR_MESSAGE;
        },
        extractMessageFromErrorIfAny(error: Error | undefined | unknown): string | undefined {
            return error instanceof Error ? error.message : undefined;
        },

        async handleError(interaction: TrackedInteraction, error: EndUserError | Error | unknown): Promise<void> {

            if (error instanceof EndUserError) {
                const parentError: Error | undefined | unknown = error.parentError;
                let message: string;
                if (parentError) {
                    const parentErrorMessage: string | undefined = this.extractMessageFromErrorIfAny(parentError);
                    message = parentErrorMessage ? `${error.message} ➡️ ${parentErrorMessage}` : error.message;
                } else {
                    message = error.message;
                }

                const data = DiscordStatus.Error.errorData(message);
                await interaction.respond(data);
            }
            else if (error instanceof Error) {
                const errorMessage = this.buildMessageForError(error);
                const data = DiscordStatus.Error.errorData(errorMessage)
                await interaction.respond(data);

            } else {
                const data = DiscordStatus.Error.errorData(this.DEFAULT_ERROR_MESSAGE);
                await interaction.respond(data);
            }

       },

        async error(interaction: TrackedInteraction, message: string): Promise<Message<boolean>> {
            const data = DiscordStatus.Error.errorData(message);

            return await interaction.respond(data);
        },

        errorData(message: string): any {
            return {
                content: `❌ ${message}`,
                ephemeral: true,
            };
        }
    }

    public static Success = {
        async success(interaction: TrackedInteraction, message: string): Promise<void> {
            const data = DiscordStatus.Success.successData(message);
            await interaction.respond(data);
        },

        successData(message: string): any {
            return {
                content: `✅: ${message}`,
                ephemeral: true,
            };
    }

    }

    public static Warning = {
        async warning(interaction: TrackedInteraction, message: string): Promise<void> {
            const data = DiscordStatus.Warning.warningData(message);
            await interaction.respond(data);
        },

        warningData(message: string): any {
            return {
                content: `⚠️: ${message}`,
                ephemeral: true,
            };
        }
    }

    public static Info = {
        async info(interaction: TrackedInteraction, message: string): Promise<void> {
            const data = DiscordStatus.Info.infoData(message);
            await interaction.respond(data);
        },

        infoData(message: string): any {
            return {
                content: `ℹ️: ${message}`,
                ephemeral: true,
            };
        }
    }
}