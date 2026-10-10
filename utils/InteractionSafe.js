import { createLogger } from './Logger.js';

const logger = createLogger('InteractionSafe');

// 10062 = Unknown interaction (the 3 second window passed), 40060 = already acknowledged
const BENIGN_CODES = new Set([10062, 40060]);

export function isExpiredInteractionError(error) {
  return !!error && BENIGN_CODES.has(error.code);
}

/**
 * Replies to an interaction in whatever state it is (fresh, deferred or replied) and NEVER throws.
 * Used from error handlers: if Discord already forgot the interaction (slow network, bot was busy)
 * the failure is logged and swallowed instead of crashing the bot.
 */
export async function safeRespond(interaction, payload) {
  try {
    if (interaction.deferred && !interaction.replied && interaction.isChatInputCommand?.()) {
      // Slash command that called deferReply(): turn the "thinking…" state into the message.
      // (Not for buttons/modals: those use deferUpdate(), where editReply would overwrite the
      // message that holds the controls, so they get a followUp below instead.)
      const { ephemeral, ...rest } = payload;
      return await interaction.editReply(rest);
    }
    if (interaction.replied || interaction.deferred) return await interaction.followUp(payload);
    return await interaction.reply(payload);
  } catch (error) {
    if (isExpiredInteractionError(error)) {
      logger.warn(`Could not respond to interaction ${interaction.id}: it expired or was already answered (code ${error.code}).`);
    } else {
      logger.error(`Could not respond to interaction ${interaction.id}:`, error);
    }
    return null;
  }
}
