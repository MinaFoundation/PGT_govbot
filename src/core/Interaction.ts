import { AnyInteraction, AnyInteractionWithUpdate } from "../types/common";

export class InteractionProperties {

    static isNamedChannelInteraction(interaction: AnyInteraction): boolean {
        return interaction.channel !== null && typeof interaction.channel === 'object' && 'name' in interaction.channel;
    }

    static toUpdateableOrUndefined(interaction: AnyInteraction): AnyInteractionWithUpdate | undefined {
        if (interaction !== null && typeof interaction === 'object' && 'update' in interaction) {
            return interaction as AnyInteractionWithUpdate;
        }
        
    }
}