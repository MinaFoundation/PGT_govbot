// src/components/PaginationComponent.ts

import { Action, TrackedInteraction } from '../core/BaseClasses';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageActionRowComponentBuilder, StringSelectMenuBuilder } from 'discord.js';
import { ArgumentOracle, CustomIDOracle } from '../CustomIDOracle';
import { Screen } from '../core/BaseClasses';
import { EndUserError, NotFoundEndUserError, NotFoundEndUserInfo } from '../Errors';
import logger from '../logging';

export abstract class PaginationComponent extends Action {
  public static readonly PAGE_ARG = 'page';
  public static readonly PAGINATION_ARG = 'paginate';

  protected abstract getTotalPages(interaction: TrackedInteraction): Promise<number>;
  protected abstract getItemsForPage(interaction: TrackedInteraction, page: number): Promise<any[]>;

  public getPaginationRow(
    interaction: TrackedInteraction,
    currentPage: number,
    totalPages: number,
    ...args: string[]
  ): ActionRowBuilder<ButtonBuilder> {
    const row = new ActionRowBuilder<ButtonBuilder>();

    if (currentPage > 0) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(
            CustomIDOracle.addArgumentsToAction(
              this,
              PaginationComponent.PAGINATION_ARG,
              PaginationComponent.PAGE_ARG,
              (currentPage - 1).toString(),
              ...args,
            ),
          )
          .setLabel('Previous')
          .setStyle(ButtonStyle.Secondary),
      );
    }

    if (currentPage < totalPages - 1) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(
            CustomIDOracle.addArgumentsToAction(
              this,
              PaginationComponent.PAGINATION_ARG,
              PaginationComponent.PAGE_ARG,
              (currentPage + 1).toString(),
              ...args,
            ),
          )
          .setLabel('Next')
          .setStyle(ButtonStyle.Secondary),
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

/**
 * Use this in the code, in the operation handler that shouls show the paginated list of items. Simply await on the handlePagination()
 * and let it do the rest.
 */
export abstract class ORMModelPaginator<ORMModel> extends PaginationComponent {
  public static BOOLEAN = {
    TRUE: 'yes',
    ARGUMENTS: {
      FORCE_REPLY: 'fRp',
    },
  };

  public readonly REQUIRED_ARGUMENTS: string[] = [];

  public readonly action: Action;
  public readonly operation: string;

  public abstract readonly args: string[];

  public abstract readonly title: string;
  public abstract readonly description: string;
  public abstract readonly placeholder: string;

  constructor(screen: Screen, dstAction: Action, dstOperation: string, id: string) {
    super(screen, id);
    this.action = dstAction;
    this.operation = dstOperation;
  }

  protected parseRequiredArguments(interaction: TrackedInteraction): { [key: string]: string } {
    let parsedArguments: { [key: string]: string } = {};
    for (const argument of this.REQUIRED_ARGUMENTS) {
      logger.debug(`Checking for ${argument} in ${this.REQUIRED_ARGUMENTS}`);
      const value: string = ArgumentOracle.getNamedArgument(interaction, argument);
      parsedArguments[argument] = value;
    }
    return parsedArguments;
  }

  protected getRequiredArgumentsAsList(interaction: TrackedInteraction): string[] {
    const requiredArgs: { [key: string]: string } = this.parseRequiredArguments(interaction);
    const requiredArgsAsList: string[] = requiredArgs ? Object.entries(requiredArgs).flat() : [];
    return requiredArgsAsList;
  }

  protected abstract getOptions(interaction: TrackedInteraction, items: ORMModel[]): Promise<any>;
  abstract getItems(interaction: TrackedInteraction): Promise<ORMModel[]>;

  protected async getTotalPages(interaction: TrackedInteraction): Promise<number> {
    const items = await this.getItems(interaction);
    return Math.ceil(items.length / 25);
  }

  protected async getItemsForPage(interaction: TrackedInteraction, page: number): Promise<ORMModel[]> {
    const items = await this.getItems(interaction);
    return items.slice(page * 25, (page + 1) * 25);
  }

  public async handlePagination(interaction: TrackedInteraction): Promise<void> {
    const currentPage = this.getCurrentPage(interaction);
    const totalPages = await this.getTotalPages(interaction);
    const allItems = await this.getItemsForPage(interaction, currentPage);

    const paginatorStr: string = `Page ${currentPage + 1} of ${totalPages}`;
    const fullDescription: string = `${this.description}\n\n${paginatorStr}`;

    const requiredArgsAsList = this.getRequiredArgumentsAsList(interaction);
    const allArgs: string[] = [...this.args, ...requiredArgsAsList];
    const customId: string = CustomIDOracle.addArgumentsToAction(this.action, this.operation, ...allArgs);

    const selectMenuOptions = await this.getOptions(interaction, allItems);

    if (!selectMenuOptions || selectMenuOptions.length === 0) {
      throw new NotFoundEndUserInfo('No available items found');
    }

    const selectMenu = new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(this.placeholder).addOptions(selectMenuOptions);

    const embed = new EmbedBuilder().setTitle(this.title).setDescription(fullDescription);

    const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu),
    ];

    if (totalPages > 1) {
      const paginationRow = this.getPaginationRow(interaction, currentPage, totalPages, ...requiredArgsAsList);
      components.push(paginationRow);
    }

    await this.replyOrUpdate(interaction, { embeds: [embed], components: components });
  }

  protected async replyOrUpdate(interaction: TrackedInteraction, data: any): Promise<void> {
    const isReply: boolean = ArgumentOracle.isArgumentEquals(
      interaction,
      ORMModelPaginator.BOOLEAN.ARGUMENTS.FORCE_REPLY,
      ORMModelPaginator.BOOLEAN.TRUE,
    );

    if (isReply) {
      await interaction.respond(data);
    } else {
      await interaction.update(data);
    }
  }

  public allSubActions(): Action[] {
    return [];
  }

  getComponent(...args: any[]): StringSelectMenuBuilder {
    throw new EndUserError('A paginator does not have a component');
  }
}
