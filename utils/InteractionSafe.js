import { createLogger } from './Logger.js';

const logger = createLogger('InteractionSafe');

/** MessageFlags.Ephemeral. `ephemeral: true` is deprecated in recent discord.js versions. */
export const EPHEMERAL = 1 << 6;

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
      const { ephemeral, flags, ...rest } = payload;
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

/**
 * Discord only accepts the first answer to an interaction within 3 seconds of its creation.
 * `age` is how old the interaction already was when the bot received it (delay BEFORE our code:
 * gateway/network/phone asleep); `handlerMs` is how long our handler ran, including the REST
 * round trip that carries the answer. Comparing them shows which side was slow.
 * (`age` uses the local clock, so a phone clock that is off by seconds skews it.)
 */
export function interactionAge(interaction) {
  return Date.now() - interaction.createdTimestamp;
}

export function logExpired(logger, what, interaction, startedAt) {
  logger.warn(
    `${what}: Discord had already dropped interaction ${interaction.id} (10062). ` +
    `It was ${startedAt.age}ms old when the bot received it and the handler ran ${Date.now() - startedAt.at}ms. ` +
    'age >= ~2500ms = the event reached the bot too late (network, or Android throttling Termux in the background); ' +
    'a small age with a long handler time = the reply itself was slow to reach Discord.'
  );
}
