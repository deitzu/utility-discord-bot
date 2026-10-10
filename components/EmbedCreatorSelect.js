import { EPHEMERAL } from '../utils/InteractionSafe.js';
import { buildItemModal, MODAL_KINDS } from '../utils/EmbedV2Modals.js';

const SESSION_EXPIRED = 'This session has expired (the bot may have restarted). Run `/embed` again to start a new one.';

const selects = [
  {
    // "➕ Add a component…" menu: opens the matching add modal
    customId: 'embed_creator_add_select',
    async execute(interaction) {
      const session = interaction.client.embedCreatorManager.getSession(interaction.user.id);
      if (!session) {
        return interaction.reply({ content: SESSION_EXPIRED, flags: EPHEMERAL });
      }

      const kind = interaction.values[0];
      if (!MODAL_KINDS.includes(kind)) {
        return interaction.reply({ content: 'Unknown component type.', flags: EPHEMERAL });
      }

      session.v2.pendingEdit = null; // this is an add, not an edit
      await interaction.showModal(buildItemModal(kind));
    }
  },
  {
    // Item picker: selects which item Edit / Up / Down / Copy / Delete act on
    customId: 'embed_creator_item_select',
    async execute(interaction) {
      const manager = interaction.client.embedCreatorManager;
      const session = manager.getSession(interaction.user.id);
      if (!session) {
        return interaction.reply({ content: SESSION_EXPIRED, flags: EPHEMERAL });
      }

      const index = parseInt(interaction.values[0], 10);
      manager.selectItem(interaction.user.id, Number.isNaN(index) ? -1 : index);

      await interaction.deferUpdate();
      await manager.updateControls(interaction.user.id);
    }
  }
];

export default selects;
