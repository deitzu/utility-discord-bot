import { EPHEMERAL } from '../utils/InteractionSafe.js';
import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, AttachmentBuilder } from 'discord.js';
import { createLogger } from '../utils/Logger.js';
import { getMessageStyle } from '../utils/ConfigLoader.js';
import { exportModel, LIMITS } from '../utils/EmbedV2Model.js';
import { buildColorModal, buildImportModal, buildItemModal, buildTitleModal, kindOfItem } from '../utils/EmbedV2Modals.js';

const logger = createLogger('EmbedCreatorButtons');

const SESSION_EXPIRED = 'This session has expired (the bot may have restarted). Run `/embed` again to start a new one.';

function isV2(interaction) {
  return getMessageStyle(interaction.client.embedCreatorManager.config, 'embedCreator') === 'v2';
}

async function safeReply(interaction, content) {
  const payload = { content, flags: EPHEMERAL };
  if (interaction.replied || interaction.deferred) return interaction.followUp(payload);
  return interaction.reply(payload);
}

/** Returns the running V2 session, or tells the user it expired and returns null. */
async function requireSession(interaction) {
  const session = interaction.client.embedCreatorManager.getSession(interaction.user.id);
  if (!session) {
    await safeReply(interaction, SESSION_EXPIRED);
    return null;
  }
  return session;
}

/** Acknowledges the click and re-renders the preview + controls DM messages. */
async function refresh(interaction) {
  await interaction.deferUpdate();
  await interaction.client.embedCreatorManager.refresh(interaction.user.id);
}

/** Returns the selected item index, or null (after telling the user) when nothing is selected. */
async function requireSelection(interaction, session) {
  const index = session.v2.selected;
  if (index === null || index === undefined || !session.v2.items[index]) {
    await safeReply(interaction, 'Select an item in the second menu first.');
    return null;
  }
  return index;
}

// Legacy (classic embed) helper
async function updatePreview(interaction) {
  const userId = interaction.user.id;
  const state = interaction.client.embedCreatorManager.getOrCreateState(userId);
  const targetChannel = interaction.client.channels.cache.get(state.targetChannelId);

  await interaction.deferUpdate();
  await interaction.client.embedCreatorManager.updatePreview(userId);
  await interaction.client.embedCreatorManager.updateControls(userId, targetChannel || 'unknown channel');
}

const buttons = [
  /* ---------------------------------------------------------------- */
  /* Components V2                                                     */
  /* ---------------------------------------------------------------- */
  {
    customId: 'embed_creator_v2_title',
    async execute(interaction) {
      const session = await requireSession(interaction);
      if (!session) return;
      await interaction.showModal(buildTitleModal(session.v2.title));
    }
  },
  {
    customId: 'embed_creator_v2_color',
    async execute(interaction) {
      const session = await requireSession(interaction);
      if (!session) return;
      await interaction.showModal(buildColorModal(session.embed.color));
    }
  },
  {
    customId: 'embed_creator_v2_spoiler',
    async execute(interaction) {
      if (!(await requireSession(interaction))) return;
      interaction.client.embedCreatorManager.toggleSpoiler(interaction.user.id);
      await refresh(interaction);
    }
  },
  {
    customId: 'embed_creator_v2_export',
    async execute(interaction) {
      const session = await requireSession(interaction);
      if (!session) return;

      const manager = interaction.client.embedCreatorManager;
      const json = JSON.stringify(exportModel(manager.getModel(interaction.user.id)));
      const file = new AttachmentBuilder(Buffer.from(json, 'utf-8'), { name: 'embed-v2.json' });
      const note = json.length > LIMITS.totalText
        ? `This JSON is ${json.length} characters, which is over the ${LIMITS.totalText}-character limit of the Import form, so it can only be kept as a backup.`
        : 'Paste the contents into **Import JSON** to load it again.';

      await interaction.reply({ content: `Your message as JSON. ${note}`, files: [file], flags: EPHEMERAL });
    }
  },
  {
    customId: 'embed_creator_v2_import',
    async execute(interaction) {
      if (!(await requireSession(interaction))) return;
      await interaction.showModal(buildImportModal());
    }
  },
  {
    customId: 'embed_creator_item_edit',
    async execute(interaction) {
      const session = await requireSession(interaction);
      if (!session) return;
      const index = await requireSelection(interaction, session);
      if (index === null) return;

      const item = session.v2.items[index];
      session.v2.pendingEdit = index;
      await interaction.showModal(buildItemModal(kindOfItem(item), item));
    }
  },
  {
    customId: 'embed_creator_item_up',
    async execute(interaction) {
      const session = await requireSession(interaction);
      if (!session) return;
      const index = await requireSelection(interaction, session);
      if (index === null) return;
      interaction.client.embedCreatorManager.moveItem(interaction.user.id, index, -1);
      await refresh(interaction);
    }
  },
  {
    customId: 'embed_creator_item_down',
    async execute(interaction) {
      const session = await requireSession(interaction);
      if (!session) return;
      const index = await requireSelection(interaction, session);
      if (index === null) return;
      interaction.client.embedCreatorManager.moveItem(interaction.user.id, index, 1);
      await refresh(interaction);
    }
  },
  {
    customId: 'embed_creator_item_dup',
    async execute(interaction) {
      const session = await requireSession(interaction);
      if (!session) return;
      const index = await requireSelection(interaction, session);
      if (index === null) return;
      if (interaction.client.embedCreatorManager.duplicateItem(interaction.user.id, index) === -1) {
        return safeReply(interaction, `You can have at most ${LIMITS.maxItems} items.`);
      }
      await refresh(interaction);
    }
  },
  {
    customId: 'embed_creator_item_delete',
    async execute(interaction) {
      const session = await requireSession(interaction);
      if (!session) return;
      const index = await requireSelection(interaction, session);
      if (index === null) return;
      interaction.client.embedCreatorManager.removeItem(interaction.user.id, index);
      await refresh(interaction);
    }
  },

  /* ---------------------------------------------------------------- */
  /* Classic embed mode (legacy)                                       */
  /* ---------------------------------------------------------------- */
  {
    customId: 'embed_creator_title',
    async execute(interaction) {
      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      const modal = new ModalBuilder()
        .setCustomId('embed_creator_modal_title')
        .setTitle('Set Embed Title');

      const input = new TextInputBuilder()
        .setCustomId('title_input')
        .setLabel('Title')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(state.embed.title || '');

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }
  },
  {
    customId: 'embed_creator_description',
    async execute(interaction) {
      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      const modal = new ModalBuilder()
        .setCustomId('embed_creator_modal_description')
        .setTitle('Set Embed Description');

      const input = new TextInputBuilder()
        .setCustomId('description_input')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setValue(state.embed.description || '');

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }
  },
  {
    customId: 'embed_creator_color',
    async execute(interaction) {
      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      const modal = new ModalBuilder()
        .setCustomId('embed_creator_modal_color')
        .setTitle('Set Embed Color');

      const input = new TextInputBuilder()
        .setCustomId('color_input')
        .setLabel('Color (Hex Code)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('#0099ff')
        .setValue(typeof state.embed.color === 'string' ? state.embed.color : '');

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }
  },
  {
    customId: 'embed_creator_footer',
    async execute(interaction) {
      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      const modal = new ModalBuilder()
        .setCustomId('embed_creator_modal_footer')
        .setTitle('Set Embed Footer');

      const input = new TextInputBuilder()
        .setCustomId('footer_input')
        .setLabel('Footer Text')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(state.embed.footer?.text || '');

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }
  },
  {
    customId: 'embed_creator_timestamp',
    async execute(interaction) {
      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      state.embed.timestamp = !state.embed.timestamp;
      await updatePreview(interaction);
    }
  },
  {
    customId: 'embed_creator_field_add',
    async execute(interaction) {
      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      if (state.embed.fields.length >= 25) {
        return interaction.reply({ content: 'You can only have up to 25 fields.', flags: EPHEMERAL });
      }

      const modal = new ModalBuilder()
        .setCustomId('embed_creator_modal_field')
        .setTitle('Add Field');

      const nameInput = new TextInputBuilder()
        .setCustomId('field_name')
        .setLabel('Field Name')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const valueInput = new TextInputBuilder()
        .setCustomId('field_value')
        .setLabel('Field Value')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const inlineInput = new TextInputBuilder()
        .setCustomId('field_inline')
        .setLabel('Inline? (yes/no)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('no');

      modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(valueInput),
        new ActionRowBuilder().addComponents(inlineInput)
      );
      await interaction.showModal(modal);
    }
  },
  {
    customId: 'embed_creator_field_remove',
    async execute(interaction) {
      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      if (state.embed.fields.length > 0) {
        state.embed.fields.pop();
        await updatePreview(interaction);
      } else {
        await interaction.reply({ content: 'No fields to remove.', flags: EPHEMERAL });
      }
    }
  },
  {
    customId: 'embed_creator_image',
    async execute(interaction) {
      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      const modal = new ModalBuilder()
        .setCustomId('embed_creator_modal_image')
        .setTitle('Set Embed Image');

      const input = new TextInputBuilder()
        .setCustomId('image_input')
        .setLabel('Image URL')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(state.embed.image?.url || '');

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }
  },
  {
    customId: 'embed_creator_thumbnail',
    async execute(interaction) {
      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      const modal = new ModalBuilder()
        .setCustomId('embed_creator_modal_thumbnail')
        .setTitle('Set Embed Thumbnail');

      const input = new TextInputBuilder()
        .setCustomId('thumbnail_input')
        .setLabel('Thumbnail URL')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(state.embed.thumbnail?.url || '');

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }
  },

  /* ---------------------------------------------------------------- */
  /* Shared by both modes: Send / Reset / Cancel                       */
  /* ---------------------------------------------------------------- */
  {
    customId: 'embed_creator_send',
    async execute(interaction) {
      const userId = interaction.user.id;
      const manager = interaction.client.embedCreatorManager;

      if (isV2(interaction)) {
        const session = await requireSession(interaction);
        if (!session) return;

        const targetChannelId = session.targetChannelId;
        await interaction.deferUpdate();

        const result = await manager.sendToTarget(userId);
        if (!result.success) {
          await interaction.followUp({ content: result.error, flags: EPHEMERAL });
          await manager.refresh(userId);
          return;
        }

        await manager.finishSession(userId, `✅ Message sent to <#${targetChannelId}>.`);
        return;
      }

      // Classic embed mode
      const state = manager.getOrCreateState(userId);
      const targetChannel = interaction.client.channels.cache.get(state.targetChannelId);

      if (!targetChannel) {
        return interaction.reply({ content: 'Could not find the target channel. It might have been deleted.', flags: EPHEMERAL });
      }

      const message = manager.buildMessage(userId);

      try {
        await targetChannel.send(message);
        await manager.deletePreviewAndControls(userId, interaction.user);
        manager.clearState(userId);
        await interaction.update({
          content: `✅ Message successfully sent to ${targetChannel}!`,
          embeds: [],
          components: []
        });
      } catch (error) {
        logger.error(`Error sending message to channel ${state.targetChannelId}:`, error);
        await interaction.reply({ content: 'Failed to send message to the channel. Make sure I have permission to send messages there.', flags: EPHEMERAL });
      }
    }
  },
  {
    customId: 'embed_creator_reset',
    async execute(interaction) {
      const userId = interaction.user.id;
      const manager = interaction.client.embedCreatorManager;
      logger.info('Reset button clicked', { userId, interactionId: interaction.id });

      try {
        if (isV2(interaction)) {
          if (!(await requireSession(interaction))) return;
          manager.resetState(userId);
          await refresh(interaction);
          return;
        }

        await interaction.deferUpdate();
        manager.resetState(userId);
        const state = manager.getOrCreateState(userId);
        const targetChannel = interaction.client.channels.cache.get(state.targetChannelId);

        await manager.updatePreview(userId);
        await manager.updateControls(userId, targetChannel || 'unknown channel');

        await interaction.editReply({ content: '✅ Preview has been reset to default.', components: [] });
        logger.info('Reset completed successfully', { userId, interactionId: interaction.id });
      } catch (error) {
        logger.error('Reset failed', { userId, interactionId: interaction.id, error: error.stack });
      }
    }
  },
  {
    customId: 'embed_creator_cancel',
    async execute(interaction) {
      const userId = interaction.user.id;
      const manager = interaction.client.embedCreatorManager;
      logger.info('Cancel button clicked', { userId, interactionId: interaction.id });

      try {
        if (isV2(interaction)) {
          if (!(await requireSession(interaction))) return;
          await interaction.deferUpdate();
          await manager.finishSession(userId, '❌ Embed creation cancelled.');
          return;
        }

        await interaction.deferUpdate();
        manager.clearState(userId);
        await manager.deletePreviewAndControls(userId, interaction.user);

        await interaction.editReply({ content: '❌ Embed creation cancelled.', components: [] });
        logger.info('Cancel completed successfully', { userId, interactionId: interaction.id });
      } catch (error) {
        logger.error('Cancel failed', { userId, interactionId: interaction.id, error: error.stack });
      }
    }
  }
];

export default buttons;
