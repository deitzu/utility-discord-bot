import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { createLogger } from '../utils/Logger.js';

const logger = createLogger('EmbedCreatorButtons');

async function updatePreview(interaction) {
  const userId = interaction.user.id;
  const state = interaction.client.embedCreatorManager.getOrCreateState(userId);
  const targetChannel = interaction.client.channels.cache.get(state.targetChannelId);

  await interaction.client.embedCreatorManager.updatePreview(userId);
  await interaction.client.embedCreatorManager.updateControls(userId, targetChannel || 'unknown channel');
}

const buttons = [
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
        .setValue(state.embed.color || '');

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
    customId: 'embed_creator_textdisplay_add',
    async execute(interaction) {
      const modal = new ModalBuilder()
        .setCustomId('embed_creator_modal_textdisplay')
        .setTitle('Add Text Display');

      const input = new TextInputBuilder()
        .setCustomId('text_input')
        .setLabel('Content')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder('Enter markdown content...');

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }
  },
  {
    customId: 'embed_creator_textdisplay_remove',
    async execute(interaction) {
      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      if (state.v2.textDisplays.length > 0) {
        interaction.client.embedCreatorManager.removeTextDisplay(interaction.user.id);
        await updatePreview(interaction);
      } else {
        await interaction.reply({ content: 'No text displays to remove.', ephemeral: true });
      }
    }
  },
  {
    customId: 'embed_creator_separator_add',
    async execute(interaction) {
      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      if (state.v2.textDisplays.length === 0) {
        return interaction.reply({ content: 'Add some text displays first before adding separators.', ephemeral: true });
      }

      const modal = new ModalBuilder()
        .setCustomId('embed_creator_modal_separator')
        .setTitle('Add Separator');

      const input = new TextInputBuilder()
        .setCustomId('index_input')
        .setLabel(`After Text Index (0 to ${state.v2.textDisplays.length - 1})`)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Enter the index number...');

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }
  },
  {
    customId: 'embed_creator_markdown_line',
    async execute(interaction) {
      interaction.client.embedCreatorManager.toggleMarkdownLine(interaction.user.id);
      await updatePreview(interaction);
    }
  },
  {
    customId: 'embed_creator_button_add',
    async execute(interaction) {
      const modal = new ModalBuilder()
        .setCustomId('embed_creator_modal_button')
        .setTitle('Add Button');

      const labelInput = new TextInputBuilder()
        .setCustomId('button_label')
        .setLabel('Button Label')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const idInput = new TextInputBuilder()
        .setCustomId('button_id')
        .setLabel('Button Custom ID (Optional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('my_custom_id');

      modal.addComponents(
        new ActionRowBuilder().addComponents(labelInput),
        new ActionRowBuilder().addComponents(idInput)
      );
      await interaction.showModal(modal);
    }
  },
  {
    customId: 'embed_creator_field_add',
    async execute(interaction) {
      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      if (state.embed.fields.length >= 25) {
        return interaction.reply({ content: 'You can only have up to 25 fields.', ephemeral: true });
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
        await interaction.reply({ content: 'No fields to remove.', ephemeral: true });
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
  {
    customId: 'embed_creator_send',
    async execute(interaction) {
      const userId = interaction.user.id;
      const state = interaction.client.embedCreatorManager.getOrCreateState(userId);
      const targetChannel = interaction.client.channels.cache.get(state.targetChannelId);

      if (!targetChannel) {
        return interaction.reply({ content: 'Could not find the target channel. It might have been deleted.', ephemeral: true });
      }

      const message = interaction.client.embedCreatorManager.buildMessage(userId);
      
      try {
        await targetChannel.send(message);
        await interaction.client.embedCreatorManager.deletePreviewAndControls(userId, interaction.user);
        interaction.client.embedCreatorManager.clearState(userId);
        await interaction.update({
          content: `✅ Message successfully sent to ${targetChannel}!`,
          embeds: [],
          components: []
        });
      } catch (error) {
        logger.error(`Error sending message to channel ${state.targetChannelId}:`, error);
        await interaction.reply({ content: 'Failed to send message to the channel. Make sure I have permission to send messages there.', ephemeral: true });
      }
    }
  },
  {
    customId: 'embed_creator_reset',
    async execute(interaction) {
      const userId = interaction.user.id;
      interaction.client.embedCreatorManager.resetState(userId);
      const state = interaction.client.embedCreatorManager.getOrCreateState(userId);
      const targetChannel = interaction.client.channels.cache.get(state.targetChannelId);

      await interaction.client.embedCreatorManager.updatePreview(userId);
      await interaction.client.embedCreatorManager.updateControls(userId, targetChannel || 'unknown channel');
    }
  },
  {
    customId: 'embed_creator_cancel',
    async execute(interaction) {
      const userId = interaction.user.id;
      interaction.client.embedCreatorManager.clearState(userId);
      await interaction.client.embedCreatorManager.deletePreviewAndControls(userId, interaction.user);
    }
  }
];

export default buttons;
