import { EPHEMERAL } from '../utils/InteractionSafe.js';
import { LIMITS, importModel, parseHexColor, validateItem } from '../utils/EmbedV2Model.js';
import { MODAL_IDS, MODAL_KINDS, itemLabel, kindOfItem, parseItemFromModal } from '../utils/EmbedV2Modals.js';

const SESSION_EXPIRED = 'This session has expired (the bot may have restarted). Run `/embed` again to start a new one.';

// Legacy (classic embed) helper
async function updatePreview(interaction) {
  const userId = interaction.user.id;
  await interaction.deferUpdate();
  await interaction.client.embedCreatorManager.updatePreview(userId);
}

function replyEphemeral(interaction, content) {
  return interaction.reply({ content, flags: EPHEMERAL });
}

/** Acknowledges the submit and re-renders the preview + controls DM messages. */
async function refresh(interaction) {
  await interaction.deferUpdate();
  await interaction.client.embedCreatorManager.refresh(interaction.user.id);
}

/**
 * Shared add/edit flow for every item modal: parse -> validate -> add or replace -> re-render.
 * Invalid input is rejected with an explanation instead of being stored.
 */
async function submitItemModal(interaction, kind) {
  const manager = interaction.client.embedCreatorManager;
  const userId = interaction.user.id;
  const session = manager.getSession(userId);
  if (!session) return replyEphemeral(interaction, SESSION_EXPIRED);

  const parsed = parseItemFromModal(kind, interaction.fields);
  if (parsed.error) {
    return replyEphemeral(interaction, `Couldn't save that: ${parsed.error}\nOpen the form again to retry.`);
  }

  const problems = validateItem(parsed.item);
  if (problems.length > 0) {
    const list = problems.slice(0, 6).map(p => `• ${p}`).join('\n');
    return replyEphemeral(interaction, `Couldn't save that ${itemLabel(kind).toLowerCase()}:\n${list}\nOpen the form again to retry.`);
  }

  const editing = session.v2.pendingEdit;
  session.v2.pendingEdit = null;

  const existing = editing !== null && editing !== undefined ? session.v2.items[editing] : null;
  if (existing && kindOfItem(existing) === kind) {
    manager.replaceItem(userId, editing, parsed.item);
  } else if (manager.addItem(userId, parsed.item) === -1) {
    return replyEphemeral(interaction, `You can have at most ${LIMITS.maxItems} items.`);
  }

  await refresh(interaction);
}

const v2Modals = [
  ...MODAL_KINDS.map(kind => ({
    customId: MODAL_IDS[kind],
    async execute(interaction) {
      await submitItemModal(interaction, kind);
    }
  })),
  {
    customId: MODAL_IDS.title,
    async execute(interaction) {
      const manager = interaction.client.embedCreatorManager;
      if (!manager.getSession(interaction.user.id)) return replyEphemeral(interaction, SESSION_EXPIRED);
      manager.setTitle(interaction.user.id, interaction.fields.getTextInputValue('title_input'));
      await refresh(interaction);
    }
  },
  {
    customId: MODAL_IDS.color,
    async execute(interaction) {
      const manager = interaction.client.embedCreatorManager;
      if (!manager.getSession(interaction.user.id)) return replyEphemeral(interaction, SESSION_EXPIRED);

      const parsed = parseHexColor(interaction.fields.getTextInputValue('color_input'));
      if (parsed.error) return replyEphemeral(interaction, parsed.error);

      manager.setColor(interaction.user.id, parsed.value);
      await refresh(interaction);
    }
  },
  {
    customId: MODAL_IDS.import,
    async execute(interaction) {
      const manager = interaction.client.embedCreatorManager;
      if (!manager.getSession(interaction.user.id)) return replyEphemeral(interaction, SESSION_EXPIRED);

      const result = importModel(interaction.fields.getTextInputValue('import_json'));
      if (result.error) return replyEphemeral(interaction, `Import failed:\n${result.error}`);

      manager.replaceModel(interaction.user.id, result.model);
      await refresh(interaction);
    }
  }
];

const legacyModals = [
  {
    customId: 'embed_creator_modal_title',
    async execute(interaction) {
      const title = interaction.fields.getTextInputValue('title_input');
      interaction.client.embedCreatorManager.updateState(interaction.user.id, { title });
      await updatePreview(interaction);
    }
  },
  {
    customId: 'embed_creator_modal_description',
    async execute(interaction) {
      const description = interaction.fields.getTextInputValue('description_input');
      interaction.client.embedCreatorManager.updateState(interaction.user.id, { description });
      await updatePreview(interaction);
    }
  },
  {
    customId: 'embed_creator_modal_color',
    async execute(interaction) {
      let color = interaction.fields.getTextInputValue('color_input');
      if (color && !color.startsWith('#')) color = '#' + color;

      // Simple hex validation
      if (color && !/^#[0-9A-F]{6}$/i.test(color)) {
        return interaction.reply({ content: 'Invalid hex color format. Use something like #0099ff', flags: EPHEMERAL });
      }

      interaction.client.embedCreatorManager.updateState(interaction.user.id, { color: color || undefined });
      await updatePreview(interaction);
    }
  },
  {
    customId: 'embed_creator_modal_footer',
    async execute(interaction) {
      const text = interaction.fields.getTextInputValue('footer_input');
      interaction.client.embedCreatorManager.updateState(interaction.user.id, { footer: { text } });
      await updatePreview(interaction);
    }
  },
  {
    customId: 'embed_creator_modal_field',
    async execute(interaction) {
      const name = interaction.fields.getTextInputValue('field_name');
      const value = interaction.fields.getTextInputValue('field_value');
      const inline = interaction.fields.getTextInputValue('field_inline').toLowerCase() === 'yes';

      const state = interaction.client.embedCreatorManager.getOrCreateState(interaction.user.id);
      state.embed.fields.push({ name, value, inline });

      await updatePreview(interaction);
    }
  },
  {
    customId: 'embed_creator_modal_image',
    async execute(interaction) {
      const url = interaction.fields.getTextInputValue('image_input');
      interaction.client.embedCreatorManager.updateState(interaction.user.id, { image: { url } });
      await updatePreview(interaction);
    }
  },
  {
    customId: 'embed_creator_modal_thumbnail',
    async execute(interaction) {
      const url = interaction.fields.getTextInputValue('thumbnail_input');
      interaction.client.embedCreatorManager.updateState(interaction.user.id, { thumbnail: { url } });
      await updatePreview(interaction);
    }
  }
];

const modals = [...v2Modals, ...legacyModals];

export default modals;
