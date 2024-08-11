// src/components/PaginationComponent.ts

import { Action, TrackedInteraction } from '../core/BaseClasses';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { CustomIDOracle } from '../CustomIDOracle';

export abstract class PaginationComponent extends Action {
  public static readonly PAGE_ARG = 'page';
  public static readonly PAGINATION_ARG = 'paginate';

  protected abstract getTotalPages(interaction: TrackedInteraction): Promise<number>;
  protected abstract getItemsForPage(interaction: TrackedInteraction, page: number): Promise<any[]>;

  public getPaginationRow(interaction: TrackedInteraction, currentPage: number, totalPages: number, ...args: string[]): ActionRowBuilder<ButtonBuilder> {
    const row = new ActionRowBuilder<ButtonBuilder>();

    if (currentPage > 0) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(CustomIDOracle.addArgumentsToAction(this, PaginationComponent.PAGINATION_ARG, PaginationComponent.PAGE_ARG, (currentPage - 1).toString(), ...args))
          .setLabel('Previous')
          .setStyle(ButtonStyle.Secondary)
      );
    }

    if (currentPage < totalPages - 1) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(CustomIDOracle.addArgumentsToAction(this, PaginationComponent.PAGINATION_ARG, PaginationComponent.PAGE_ARG, (currentPage + 1).toString(), ...args))
          .setLabel('Next')
          .setStyle(ButtonStyle.Secondary)
      );
    }

    return row;
  }

  public getCurrentPage(interaction: TrackedInteraction): number {
    const pageArg = CustomIDOracle.getNamedArgument(interaction.customId, PaginationComponent.PAGE_ARG);
    return pageArg ? parseInt(pageArg) : 0;
  }

  protected async handlePagination(interaction: TrackedInteraction): Promise<void> {
    const currentPage = this.getCurrentPage(interaction);
    const totalPages = await this.getTotalPages(interaction);
    const items = await this.getItemsForPage(interaction, currentPage);

    // Implement the pagination logic here
    // This will be different for each Action that extends PaginationComponent
    // You should update the interaction with the new page of items
  }

  protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
    if (operationId === 'paginate') {
      await this.handlePagination(interaction);
    } else {
      await this.handleInvalidOperation(interaction, operationId);
    }
  }
}