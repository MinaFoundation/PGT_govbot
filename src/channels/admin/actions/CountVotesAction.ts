import { Action, TrackedInteraction, Screen } from '../../../core/BaseClasses';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import { ArgumentOracle, CustomIDOracle } from '../../../CustomIDOracle';
import { AllFundingRoundsPaginator, FundingRoundPaginator } from '../../../components/FundingRoundPaginator';
import { VoteCountingLogic } from '../../../logic/VoteCountingLogic';
import { EndUserError } from '../../../Errors';
import { AnyModalMessageComponent } from '../../../types/common';
import { DiscordStatus } from '../../DiscordStatus';
import { Client } from 'discord.js';

export class CountVotesAction extends Action {
  public allSubActions(): Action[] {
    return [];
  }
  getComponent(...args: any[]): AnyModalMessageComponent {
    throw new Error('Method not implemented.');
  }
  public static readonly ID = 'countVotes';

  private fundingRoundPaginator: FundingRoundPaginator;

  constructor(screen: Screen, id: string) {
    super(screen, id);
    this.fundingRoundPaginator = new AllFundingRoundsPaginator(screen, this, 'selectPhase', 'fundingRoundPaginator');
  }

  protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
    switch (operationId) {
      case 'selectFundingRound':
        await this.handleSelectFundingRound(interaction);
        break;
      case 'selectPhase':
        await this.handleSelectPhase(interaction);
        break;
      case 'countVotes':
        await this.handleCountVotes(interaction);
        break;
      default:
        throw new EndUserError('Invalid operation');
    }
  }

  private async handleSelectFundingRound(interaction: TrackedInteraction): Promise<void> {
    await this.fundingRoundPaginator.handlePagination(interaction);
  }

  private async handleSelectPhase(interaction: TrackedInteraction): Promise<void> {
    const fundingRoundId = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, 0);

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Select Funding Round Phase')
      .setDescription('Choose the phase for which you want to count votes:');

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(CustomIDOracle.addArgumentsToAction(this, 'countVotes', ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, fundingRoundId.toString()))
        .setPlaceholder('Select a phase')
        .addOptions([
          { label: 'Consideration Phase', value: 'consideration' },
          { label: 'Deliberation Phase', value: 'deliberation' },
          { label: 'Voting Phase', value: 'voting' },
        ]),
    );

    await interaction.update({ embeds: [embed], components: [row] });
  }

  private async handleCountVotes(interaction: TrackedInteraction): Promise<void> {
    await interaction.interaction.deferReply();

    const fundingRoundId = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);
    const phase = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.PHASE, 0);

    const progressEmbed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Counting Votes')
      .setDescription('Please wait while our quantum computers count all possible vote outcomes...');

    await interaction.interaction.editReply({ embeds: [progressEmbed], components: [] });

    let updateCounter = 0;
    const updateInterval = setInterval(async () => {
      updateCounter++;
      progressEmbed.setDescription(
        `Please wait while our quantum computers count all possible vote outcomes...\nTime elapsed: ${updateCounter * 5} seconds`,
      );
      await interaction.interaction.editReply({ embeds: [progressEmbed] });
    }, 5000);

    try {
      const voteResults = await VoteCountingLogic.countVotes(parseInt(fundingRoundId), phase, interaction);

      clearInterval(updateInterval);

      const resultEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`Vote Count Results - ${phase.charAt(0).toUpperCase() + phase.slice(1)} Phase`)
        .setDescription('Here are the vote counts for each project:');

      voteResults.forEach((result, index) => {
        let voteInfo = `Yes Votes: ${result.yesVotes}\nNo Votes: ${result.noVotes}`;
        if (phase === 'deliberation' && result.approvedModifiedVotes !== undefined) {
          voteInfo += `\nApproved Modified Votes: ${result.approvedModifiedVotes}`;
        }

        let voterInfo = `Yes Voters: ${result.yesVoters.join(', ')}\nNo Voters: ${result.noVoters.join(', ')}`;
        if (phase === 'deliberation' && result.approvedModifiedVoters) {
          voterInfo += `\nApproved Modified Voters: ${result.approvedModifiedVoters.join(', ')}`;
        }

        resultEmbed.addFields({
          name: `${index + 1}. ${result.projectName} (ID: ${result.projectId})`,
          value: `Proposer: ${result.proposerUsername}\n${voteInfo}\n\n${voterInfo}`,
        });
      });

      await interaction.interaction.editReply({ embeds: [resultEmbed], components: [] });
    } catch (error) {
      clearInterval(updateInterval);
      if (error instanceof EndUserError) {
        throw error;
      } else {
        throw new EndUserError('An unexpected error occurred while counting votes.');
      }
    }
  }
}
