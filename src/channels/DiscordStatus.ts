import { TrackedInteraction } from "../core/BaseClasses";
import { EndUserError } from "../Errors";


export class DiscordStatus {

    public static Error = {

        async handleError(interaction: TrackedInteraction, error: unknown, message: string): Promise<void> {

            if (error instanceof Error) {
                const errorMessage = error instanceof EndUserError ? `${message}: ${error.message}` : `Oops! There's been an error while processing your request. Please contact support.`;
                const data = DiscordStatus.Error.errorData(errorMessage)
                await interaction.respond(data);

            } else {
                const errorMessage = `Oops! There's been an error while processing your request. Please contact support.`;
                const data = DiscordStatus.Error.errorData(errorMessage);
                await interaction.respond(data);
            }

       },

        async error(interaction: TrackedInteraction, message: string): Promise<void> {
            const data = DiscordStatus.Error.errorData(message);

            await interaction.respond(data);
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