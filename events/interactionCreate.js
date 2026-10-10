import { createLogger } from '../utils/Logger.js';

const logger = createLogger('InteractionEvent');

export default {
  name: 'interactionCreate',
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) {
        logger.warn(`No command matching ${interaction.commandName} was found.`);
        return;
      }
      
      try {
        await command.execute(interaction);
      } catch (error) {
        logger.error(`Error executing ${interaction.commandName}:`, error);
        
        const errorMessage = {
          content: 'There was an error while executing this command!',
          ephemeral: true
        };
        
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
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
          await interaction.reply({
            content: `This ${kind} doesn't have an action yet. Link buttons open a URL; interactive ones need a handler registered for their custom ID.`,
            ephemeral: true
          }).catch(() => {});
        }
        return;
      }

      try {
        await component.execute(interaction);
      } catch (error) {
        logger.error(`Error executing ${kind} ${interaction.customId}:`, error);
        const replyOptions = { content: 'There was an error handling this interaction!', ephemeral: true };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(replyOptions);
        } else {
          await interaction.reply(replyOptions);
        }
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
        logger.error(`Error executing modal ${interaction.customId}:`, error);
        const replyOptions = { content: 'There was an error handling this interaction!', ephemeral: true };
        
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(replyOptions);
        } else {
          await interaction.reply(replyOptions);
        }
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
