import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { createLogger } from '../utils/Logger.js';
import { getMessageStyle } from '../utils/ConfigLoader.js';

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
    const style = getMessageStyle(interaction.client.embedCreatorManager.config, 'embedCreator');

    try {
      if (style === 'v2') {
        // New dual-message V2 approach
        interaction.client.embedCreatorManager.getOrCreateState(user.id, targetChannel.id);
        const result = await interaction.client.embedCreatorManager.sendPreviewAndControls(user.id, targetChannel, user);
        
        if (!result.success) {
          await interaction.reply({
            content: result.error === 'Failed to build V2 messages' 
              ? 'Failed to create embed preview. Please try again.'
              : 'I couldn\'t send you a DM. Please make sure your DMs are open!',
            ephemeral: true
          });
          return;
        }

        await interaction.reply({
          content: 'I\'ve sent you a DM to start creating your embed!',
          ephemeral: true
        });
      } else {
        // Legacy embed approach (unchanged)
        const state = interaction.client.embedCreatorManager.getOrCreateState(user.id, targetChannel.id);
        const message = interaction.client.embedCreatorManager.buildMessage(user.id, { includeComponents: true, targetChannel });

        const dmMessage = await user.send(message);

        state.previewMessageId = dmMessage.id;

        await interaction.reply({
          content: 'I\'ve sent you a DM to start creating your embed!',
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
