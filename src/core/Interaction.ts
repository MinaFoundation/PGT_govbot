import { ModalSubmitInteraction } from "discord.js";
import { AnyInteraction, AnyInteractionWithDefinedChannel, AnyInteractionWithShowModal, AnyInteractionWithUpdate, AnyInteractionWithValues } from "../types/common";

export class InteractionProperties {

    static isNamedChannelInteraction(interaction: AnyInteraction): boolean {
        return interaction.channel !== null && typeof interaction.channel === 'object' && 'name' in interaction.channel;
    }

    static toInteractionWithValuesOrUndefined(interaction: AnyInteraction): AnyInteractionWithValues | undefined {
        if (interaction !== null && typeof interaction === 'object' && 'values' in interaction) {
          return interaction as AnyInteractionWithValues;
        }
      }

    static toDefineChannelOrUndefined(interaction: AnyInteraction): AnyInteractionWithDefinedChannel | undefined {
        if (interaction !== null && typeof interaction === 'object' && 'channel' in interaction && interaction.channel !== null) {
            return interaction as AnyInteractionWithDefinedChannel;
        }

    }

    static toUpdateableOrUndefined(interaction: AnyInteraction): AnyInteractionWithUpdate | undefined {
        if (interaction !== null && typeof interaction === 'object' && 'update' in interaction) {
            return interaction as AnyInteractionWithUpdate;
        }
    }

    static toShowModalOrUndefined(interaction: AnyInteraction): AnyInteractionWithShowModal | undefined {
        if (interaction !== null && typeof interaction === 'object' && 'showModal' in interaction) {
            return interaction as AnyInteractionWithShowModal;
        }
    }

    static toModalSubmitInteractionOrUndefined(interaction: AnyInteraction): ModalSubmitInteraction | undefined {
        // if the interaction is of type ModalSubmitInteraction, then cast it and return, otherwise, return undefined
        if (interaction instanceof ModalSubmitInteraction) {
            return interaction as ModalSubmitInteraction;
        }
    }
}