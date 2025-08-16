const { decideAction } = require('./decisionLogic');
const { executeAction } = require('./executor');

/**
 * Main orchestrator function
 * @param {Object} input - Generic input object with type and data
 * @returns {Promise<Object>} Result from executed tool
 */
async function orchestrate(input) {
  try {
    console.log('🎯 Orchestrator: Processing input', { type: input.type });
    
    // Step 1: Decide what tool to use
    const action = decideAction(input);
    if (!action) {
      throw new Error(`Unknown input type: ${input.type}`);
    }
    
    console.log('🧠 Decision:', action);
    
    // Step 2: Execute the chosen tool
    const result = await executeAction(action);
    
    console.log('✅ Orchestrator: Success');
    return result;
    
  } catch (error) {
    console.error('❌ Orchestrator: Error', error.message);
    throw error;
  }
}

module.exports = { orchestrate };