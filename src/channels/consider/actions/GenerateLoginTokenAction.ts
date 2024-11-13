import { ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { Action, Screen, TrackedInteraction } from '../../../core/BaseClasses';
import { CustomIDOracle } from '../../../CustomIDOracle';
import { CONSIDERATION_CONSTANTS } from '../Constants';
import { AuthTokenGenerator } from '../../../utils/jwt';
import { EndUserError } from '../../../Errors';
import { DiscordLimiter } from '../../../utils/DiscordLimiter';

export class GenerateLoginTokenAction extends Action {
  private tokenGenerator: AuthTokenGenerator;

  constructor(screen: Screen, actionId: string) {
    super(screen, actionId);
    this.tokenGenerator = new AuthTokenGenerator(
      process.env.DISCORD_CLIENT_ID!,
      process.env.MEF_FE_BASE_URL!,
      process.env.JWT_PRIVATE_KEY_RS512!,
      process.env.JWT_PUBLIC_KEY_RS512!,
    );
  }

  protected async handleOperation(interaction: TrackedInteraction, operationId: string): Promise<void> {
    switch (operationId) {
      case CONSIDERATION_CONSTANTS.OPERATION_IDS.GENERATE_LOGIN_TOKEN:
        await this.handleGenerateLoginToken(interaction);
        break;
      default:
        await this.handleInvalidOperation(interaction, operationId);
    }
  }

  private async handleGenerateLoginToken(interaction: TrackedInteraction): Promise<void> {
    try {
      if (!interaction.interaction.isButton()) {
        throw new EndUserError('Invalid interaction type');
      }

      const loginUrl = await this.tokenGenerator.generateLoginUrl(interaction.interaction);

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('Login to MEF')
        .setDescription(
          `Click the link below to log in:\n\n🔐 [Click here to login](${loginUrl})\n\n*This login link will expire in 30 seconds for security.*`,
        );

      await interaction.respond({
        embeds: [embed],
        ephemeral: true,
      });
    } catch (error) {
      throw new EndUserError('Failed to generate login token', error);
    }
  }

  public allSubActions(): Action[] {
    return [];
  }

  getComponent(): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(CustomIDOracle.addArgumentsToAction(this, CONSIDERATION_CONSTANTS.OPERATION_IDS.GENERATE_LOGIN_TOKEN))
      .setLabel('Login to MEF')
      .setStyle(ButtonStyle.Secondary);
  }
}
