import { TrackedInteraction } from "../core/BaseClasses";


export class DiscordStatus {

    public static Error = {
        async error(interaction: TrackedInteraction, message: string): Promise<void> {
            const data = DiscordStatus.Error.errorData(message);

            await interaction.respond(data);
        },

        errorData(message: string): any {
            return {
                content: `❌: ${message}`,
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