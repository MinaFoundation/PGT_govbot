import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Embed, EmbedBuilder, MessageActionRowComponentBuilder, StringSelectMenuBuilder } from "discord.js";
import { FundingRoundLogic } from "../channels/admin/screens/FundingRoundLogic";
import { Action, TrackedInteraction } from "../core/BaseClasses";
import { EndUserError } from "../Errors";
import { FundingRound } from "../models";
import { PaginationComponent } from "./PaginationComponent";
import { ArgumentOracle, CustomIDOracle } from "../CustomIDOracle";
import { Screen } from "../core/BaseClasses";
import logger from "../logging";

/**
 * Reusable pagniator component for the selection of Funding Rounds. Invoke .showFundingRoundSelect() with
 * the action & operation to which the fundingRoundId selection shold be passed in the customId.
 */
export class FundingRoundPaginator extends PaginationComponent {
    public static readonly ID = 'fundingRoundPagination';
    public readonly action: Action;
    public readonly operation: string;
    public readonly args: string[];
    public readonly title: string;
    public readonly customId: string;


    public static BOOLEAN = {
        TRUE: 'yes',
        ARGUMENTS: {
            FORCE_REPLY: 'fRp'
        }
    }

    /**
     * Override this method to customize the list of Funding Rounds which should be presented/paginated.
     */
    protected async getFundingRounds(interaction: TrackedInteraction): Promise<FundingRound[]> {
        return await FundingRoundLogic.getPresentAndFutureFundingRounds();
    }

    constructor(screen: Screen, dstAction: Action, dstOperation: string, args: string[], title: string) {
        super(screen, FundingRoundPaginator.ID);
        this.action = dstAction;
        this.operation = dstOperation;
        this.args = args;
        this.title = title;
        this.customId =  CustomIDOracle.addArgumentsToAction(this.action, this.operation, ...this.args);
    }

    protected async getTotalPages(interaction: TrackedInteraction): Promise<number> {
        const fundingRounds = await this.getFundingRounds(interaction);
        return Math.ceil(fundingRounds.length / 25);
    }

    protected async getItemsForPage(interaction: TrackedInteraction, page: number): Promise<FundingRound[]> {
        const fundingRounds = await this.getFundingRounds(interaction);
        return fundingRounds.slice(page * 25, (page + 1) * 25);
    }


    public async handlePagination(interaction: TrackedInteraction): Promise<void> {

        const currentPage = this.getCurrentPage(interaction);
        const totalPages = await this.getTotalPages(interaction);
        const fundingRounds = await this.getItemsForPage(interaction, currentPage);


        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(this.customId)
            .setPlaceholder(`Select a Funding Round`)
            .addOptions(fundingRounds.map((fr: FundingRound) => ({
                label: fr.name,
                value: fr.id.toString(),
                description: `Budget: ${fr.budget}, Status: ${fr.status}`
            })));

        const embed = new EmbedBuilder()
            .setTitle(this.title)
            .setDescription(`To continue, select a Funding Round from the list below`);

        const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)
        ];

        if (totalPages > 1) {
            const paginationRow = this.getPaginationRow(interaction, currentPage, totalPages);
            components.push(paginationRow);
        }

        const isReply: boolean = ArgumentOracle.isArgumentEquals(interaction, FundingRoundPaginator.BOOLEAN.ARGUMENTS.FORCE_REPLY, FundingRoundPaginator.BOOLEAN.TRUE);
        const data = { embeds: [embed], components };
        
        if (isReply) {
            await interaction.respond(data);
        } else {
            await interaction.update(data);
        }
    }


    public allSubActions(): Action[] {
        return [];
    }

    public getPaginationRow(interaction: TrackedInteraction, currentPage: number, totalPages: number, ...args: string[]): ActionRowBuilder<ButtonBuilder> {
        const row = new ActionRowBuilder<ButtonBuilder>();
    
        if (currentPage > 0) {
            const thisActionCustomId = CustomIDOracle.addArgumentsToAction(this, PaginationComponent.PAGINATION_ARG, PaginationComponent.PAGE_ARG, (currentPage - 1).toString(), ...args);
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(thisActionCustomId)
              .setLabel('Previous')
              .setStyle(ButtonStyle.Secondary)
          );
        }
    
        if (currentPage < totalPages - 1) {
            const thisActionCustomId = CustomIDOracle.addArgumentsToAction(this, PaginationComponent.PAGINATION_ARG, PaginationComponent.PAGE_ARG, (currentPage + 1).toString(), ...args);
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(thisActionCustomId)
              .setLabel('Next')
              .setStyle(ButtonStyle.Secondary)
          );
        }
    
        return row;
      }

    getComponent(...args: any[]): StringSelectMenuBuilder {
        return new StringSelectMenuBuilder()
            .setCustomId(CustomIDOracle.addArgumentsToAction(this, 'paginate'))
            .setPlaceholder('Select a Funding Round');
    }
}

export class InVotingFundingRoundPaginator extends FundingRoundPaginator {
    protected async getFundingRounds(interaction: TrackedInteraction): Promise<FundingRound[]> {
        return await FundingRoundLogic.getEligibleVotingRounds();
    }
}