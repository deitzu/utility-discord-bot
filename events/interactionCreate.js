import { createLogger } from '../utils/Logger.js';
import { EPHEMERAL, interactionAge, isExpiredInteractionError, logExpired, safeRespond } from '../utils/InteractionSafe.js';

const logger = createLogger('InteractionEvent');

export default {
  name: 'interactionCreate',
  async execute(interaction) {
    const started = { at: Date.now(), age: interactionAge(interaction) };
    if (started.age > 2000 && !interaction.isAutocomplete()) {
      logger.warn(`Interaction ${interaction.id} reached the bot ${started.age}ms after it was created; Discord only waits 3000ms for the first answer.`);
    }

    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) {
        logger.warn(`No command matching ${interaction.commandName} was found.`);
        return;
      }
      
      try {
        await command.execute(interaction);
      } catch (error) {
        if (isExpiredInteractionError(error)) {
          logExpired(logger, `command ${interaction.commandName}`, interaction, started);
          return;
        }
        logger.error(`Error executing ${interaction.commandName}:`, error);
        
        await safeRespond(interaction, {
          content: 'There was an error while executing this command!',
          flags: EPHEMERAL
        });
      }
    }
    
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
      const kind = interaction.isButton() ? 'button' : 'select menu';
      const component = interaction.client.components?.get(interaction.customId);
      if (!component) {
        logger.warn(`No component matching ${interaction.customId} was found.`);
        // Buttons/selects created in the Embed Creator get auto IDs starting with "v2_".
        // Answer them instead of letting Discord show "This interaction failed".
        if (interaction.customId.startsWith('v2_')) {
          await safeRespond(interaction, {
            content: `This ${kind} doesn't have an action yet. Link buttons open a URL; interactive ones need a handler registered for their custom ID.`,
            flags: EPHEMERAL
          });
        }
        return;
      }

      try {
        await component.execute(interaction);
      } catch (error) {
        if (isExpiredInteractionError(error)) {
          logExpired(logger, `${kind} ${interaction.customId}`, interaction, started);
          return;
        }
        logger.error(`Error executing ${kind} ${interaction.customId}:`, error);
        await safeRespond(interaction, { content: 'There was an error handling this interaction!', flags: EPHEMERAL });
      }
    }
    
    if (interaction.isModalSubmit()) {
      const component = interaction.client.components?.get(interaction.customId);
      if (!component) {
        logger.warn(`No component matching ${interaction.customId} was found.`);
        return;
      }
      
      try {
        await component.execute(interaction);
      } catch (error) {
        if (isExpiredInteractionError(error)) {
          logExpired(logger, `modal ${interaction.customId}`, interaction, started);
          return;
        }
        logger.error(`Error executing modal ${interaction.customId}:`, error);
        await safeRespond(interaction, { content: 'There was an error handling this interaction!', flags: EPHEMERAL });
      }
    }
    
    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command || !command.autocomplete) {
        logger.warn(`No autocomplete handler found for ${interaction.commandName}`);
        return;
      }
      
      try {
        await command.autocomplete(interaction);
      } catch (error) {
        logger.error(`Error executing autocomplete for ${interaction.commandName}:`, error);
      }
    }
  }
};
