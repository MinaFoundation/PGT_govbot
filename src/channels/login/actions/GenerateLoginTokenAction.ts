import { ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { Action, Screen, TrackedInteraction } from '../../../core/BaseClasses';
import { CustomIDOracle } from '../../../CustomIDOracle';
import { AuthTokenGenerator } from '../../../utils/jwt';
import { EndUserError } from '../../../Errors';
import logger from '../../../logging';
import { DiscordStatus } from '../../../channels/DiscordStatus';

export class GenerateLoginTokenAction extends Action {
  public static readonly ID = 'generateLoginToken';
  public static readonly OPERATION_IDS = {
    GENERATE_LOGIN_TOKEN: 'generate_login_token',
  };

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
    logger.debug(`Handling operation ${operationId} for interaction ${interaction.customId}`);
    
    switch (operationId) {
      case GenerateLoginTokenAction.OPERATION_IDS.GENERATE_LOGIN_TOKEN:
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
        .setTitle('🔐 Login to MEF')
        .setDescription(
          `Click the link below to log in:\n\n🔗 [Click here to login](${loginUrl})\n\n⚠️ *This login link will expire in 30 seconds for security.*`,
        );

      await interaction.respond({
        embeds: [embed],
        ephemeral: true,
      });
    } catch (error) {
      logger.error('Failed to generate login token:', error);
      await DiscordStatus.Error.error(interaction, 'Failed to generate login token');
    }
  }

  public allSubActions(): Action[] {
    return [];
  }

  getComponent(): ButtonBuilder {
    throw new Error('This method should not be called directly. Use LoginForumManager.createLoginButton instead.');
  }
} 