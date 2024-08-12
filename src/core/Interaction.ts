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

    static toInteractionWithValuesOrError(interaction: AnyInteraction): AnyInteractionWithValues {
        const interactionWithValues: AnyInteractionWithValues | undefined = this.toInteractionWithValuesOrUndefined(interaction);
        if (interactionWithValues === undefined) {
            throw new Error('Interaction does not have values.');
        }
        return interactionWithValues;
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

    static toShowModalOrError<T extends AnyInteraction>(interaction: T): AnyInteractionWithShowModal & T {
        const modalInteraction: AnyInteractionWithShowModal & T | undefined = this.toShowModalOrUndefined(interaction);
        if (modalInteraction === undefined) {
            throw new Error('Interaction does not have a showModal() method');
        }
        return modalInteraction;
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

    static toModalSubmitInteractionOrError(interaction: AnyInteraction): ModalSubmitInteraction {
        const modalSubmitInteraction: ModalSubmitInteraction | undefined = this.toModalSubmitInteractionOrUndefined(interaction);
        if (modalSubmitInteraction === undefined) {
            throw new Error('Interaction is not not a submission of a modal.');
        }
        return modalSubmitInteraction;
    }
}