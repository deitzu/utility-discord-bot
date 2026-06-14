import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { createLogger } from '../utils/Logger.js';

const logger = createLogger('EmbedCommand');

export default {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Create a custom embed via DM')
    .addChannelOption(option => 
      option.setName('channel')
        .setDescription('The channel to send the embed to')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const targetChannel = interaction.options.getChannel('channel');
    const user = interaction.user;

    try {
      // Check if user has DMs enabled
      try {
        const state = interaction.client.embedCreatorManager.getOrCreateState(user.id, targetChannel.id);
        const message = interaction.client.embedCreatorManager.buildMessage(user.id, { includeComponents: true, targetChannel });

        const dmMessage = await user.send(message);

        state.previewMessageId = dmMessage.id;

        await interaction.reply({
          content: 'I\'ve sent you a DM to start creating your embed!',
          ephemeral: true
        });
      } catch (error) {
        logger.error(`Failed to send DM to user ${user.id}:`, error);
        await interaction.reply({
          content: 'I couldn\'t send you a DM. Please make sure your DMs are open!',
          ephemeral: true
        });
      }
    } catch (error) {
      logger.error('Error in embed command:', error);
      await interaction.reply({
        content: 'An error occurred while starting the embed creator.',
        ephemeral: true
      });
    }
  }
};
