const { tools } = require('../tools/index');

/**
 * Execute the chosen tool dynamically
 * @param {Object} action - Action object with tool and params
 * @returns {Promise<Object>} Result from tool execution
 */
async function executeAction(action) {
  try {
    console.log('⚡ Executing tool:', action.tool);
    
    // Split tool path (e.g., 'dvr.create' -> ['dvr', 'create'])
    const toolPath = action.tool.split('.');
    if (toolPath.length !== 2) {
      throw new Error(`Invalid tool path: ${action.tool}`);
    }
    
    const [category, method] = toolPath;
    
    // Find the tool function
    const toolCategory = tools[category];
    if (!toolCategory) {
      throw new Error(`Tool category not found: ${category}`);
    }
    
    const toolFunction = toolCategory[method];
    if (!toolFunction) {
      throw new Error(`Tool method not found: ${category}.${method}`);
    }
    
    // Execute the tool with params
    let result;
    if (Array.isArray(action.params)) {
      // Array params - spread them as individual arguments
      result = await toolFunction(...action.params);
    } else {
      // Object params - pass as single parameter
      result = await toolFunction(action.params);
    }
    
    console.log('✅ Tool executed successfully');
    return result;
    
  } catch (error) {
    console.error('❌ Executor error:', error.message);
    throw error;
  }
}

module.exports = { executeAction };