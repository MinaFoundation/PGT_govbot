import { ModalSubmitInteraction } from "discord.js";
import { AnyInteraction, AnyInteractionWithDefinedChannel, AnyInteractionWithShowModal, AnyInteractionWithUpdate, AnyInteractionWithValues, AnyIntreactionWithFields } from "../types/common";

export class InteractionProperties<T> {

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

    static toShowModalOrUndefined<T extends AnyInteraction>(interaction: T): AnyInteractionWithShowModal & T | undefined {
        if (interaction !== null && typeof interaction === 'object' && 'showModal' in interaction) {
            return interaction as AnyInteractionWithShowModal & T;
        }
    }

    static toInteractionWithFieldsOrUndefined<T extends AnyInteraction>(interaction: AnyInteraction): AnyIntreactionWithFields & T | undefined {
        if (interaction !== null && typeof interaction === 'object' && 'fields' in interaction) {
            return interaction as AnyIntreactionWithFields & T;
        }
    }


    static toModalSubmitInteractionOrUndefined(interaction: AnyInteraction): ModalSubmitInteraction | undefined {
        // if the interaction is of type ModalSubmitInteraction, then cast it and return, otherwise, return undefined
        if (interaction instanceof ModalSubmitInteraction) {
            return interaction as ModalSubmitInteraction;
        }
    }
}