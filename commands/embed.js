import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { createLogger } from '../utils/Logger.js';
import { getMessageStyle } from '../utils/ConfigLoader.js';
import { EPHEMERAL, safeRespond } from '../utils/InteractionSafe.js';

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

    // Discord only waits 3 seconds for a first answer. Opening the DM and sending two messages
    // can take longer on a slow connection, so acknowledge right away and answer afterwards.
    try {
      await interaction.deferReply({ flags: EPHEMERAL });
    } catch (error) {
      logger.warn('Could not acknowledge /embed in time:', error.message);
      return;
    }

    try {
      if (style === 'v2') {
        // New dual-message V2 approach
        interaction.client.embedCreatorManager.getOrCreateState(user.id, targetChannel.id);
        const result = await interaction.client.embedCreatorManager.sendPreviewAndControls(user.id, targetChannel, user);

        if (!result.success) {
          await safeRespond(interaction, {
            content: result.error === 'Failed to build V2 messages'
              ? 'Failed to create embed preview. Please try again.'
              : 'I couldn\'t send you a DM. Please make sure your DMs are open!'
          });
          return;
        }
      } else {
        // Legacy embed approach (unchanged)
        const state = interaction.client.embedCreatorManager.getOrCreateState(user.id, targetChannel.id);
        const message = interaction.client.embedCreatorManager.buildMessage(user.id, { includeComponents: true, targetChannel });

        const dmMessage = await user.send(message);

        state.previewMessageId = dmMessage.id;
      }

      await safeRespond(interaction, { content: 'I\'ve sent you a DM to start creating your embed!' });
    } catch (error) {
      logger.error('Error in embed command:', error);
      await safeRespond(interaction, { content: 'An error occurred while starting the embed creator.' });
    }
  }
};
