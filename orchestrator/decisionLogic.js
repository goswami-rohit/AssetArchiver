/**
 * ACTUAL decision mapping
 */
function decideAction(input) {
  console.log('🤔 Deciding action for type:', input.type);
  
  switch (input.type) {
    // Daily Visit Reports
    case 'create_dvr':
      return {
        tool: 'dvr.create',
        params: input.data
      };
    case 'get_dvrs':
      return {
        tool: 'dvr.getByUser',
        params: [input.userId, input.data || {}]
      };
    case 'get_dvr':
      return {
        tool: 'dvr.get',
        params: input.id
      };
    case 'update_dvr':
      return {
        tool: 'dvr.update',
        params: [input.id, input.data]
      };
    case 'delete_dvr':
      return {
        tool: 'dvr.delete',
        params: input.id
      };
      
    // Technical Visit Reports
    case 'create_tvr':
      return {
        tool: 'tvr.create',
        params: input.data
      };
    case 'get_tvrs':
      return {
        tool: 'tvr.getByUser',
        params: [input.userId, input.data || {}]
      };
    case 'get_tvr':
      return {
        tool: 'tvr.get',
        params: input.id
      };
    case 'update_tvr':
      return {
        tool: 'tvr.update',
        params: [input.id, input.data]
      };
    case 'delete_tvr':
      return {
        tool: 'tvr.delete',
        params: input.id
      };
      
    // Permanent Journey Plans
    case 'create_pjp':
      return {
        tool: 'pjp.create',
        params: input.data
      };
    case 'get_pjps':
      return {
        tool: 'pjp.getByUser',
        params: [input.userId, input.data || {}]
      };
    case 'get_pjp':
      return {
        tool: 'pjp.get',
        params: input.id
      };
    case 'update_pjp':
      return {
        tool: 'pjp.update',
        params: [input.id, input.data]
      };
    case 'delete_pjp':
      return {
        tool: 'pjp.delete',
        params: input.id
      };
      
    // Dealers
    case 'create_dealer':
      return {
        tool: 'dealers.create',
        params: input.data
      };
    case 'get_dealers':
      return {
        tool: 'dealers.getByUser',
        params: [input.userId, input.data || {}]
      };
    case 'get_dealer':
      return {
        tool: 'dealers.get',
        params: input.id
      };
    case 'update_dealer':
      return {
        tool: 'dealers.update',
        params: [input.id, input.data]
      };
    case 'delete_dealer':
      return {
        tool: 'dealers.delete',
        params: input.id
      };
      
    // Client Reports
    case 'create_client_report':
      return {
        tool: 'clientReports.create',
        params: input.data
      };
    case 'get_client_reports':
      return {
        tool: 'clientReports.getByUser',
        params: [input.userId, input.data || {}]
      };
    case 'get_client_report':
      return {
        tool: 'clientReports.get',
        params: input.id
      };
    case 'update_client_report':
      return {
        tool: 'clientReports.update',
        params: [input.id, input.data]
      };
    case 'delete_client_report':
      return {
        tool: 'clientReports.delete',
        params: input.id
      };
      
    // Competition Reports
    case 'create_competition_report':
      return {
        tool: 'competitionReports.create',
        params: input.data
      };
    case 'get_competition_reports':
      return {
        tool: 'competitionReports.getByUser',
        params: [input.userId, input.data || {}]
      };
    case 'get_competition_report':
      return {
        tool: 'competitionReports.get',
        params: input.id
      };
    case 'update_competition_report':
      return {
        tool: 'competitionReports.update',
        params: [input.id, input.data]
      };
    case 'delete_competition_report':
      return {
        tool: 'competitionReports.delete',
        params: input.id
      };
      
    // Dealer Report Scores
    case 'create_dealer_score':
      return {
        tool: 'dealerReportsScores.create',
        params: input.data
      };
    case 'get_dealer_scores':
      return {
        tool: 'dealerReportsScores.getByDealer',
        params: input.dealerId
      };
    case 'update_dealer_score':
      return {
        tool: 'dealerReportsScores.update',
        params: [input.id, input.data]
      };
      
    // Attendance
    case 'punch_in':
      return {
        tool: 'attendance.punchIn',
        params: input.data
      };
      
    // Check-in/Check-out
    case 'check_in':
      return {
        tool: 'checkin.checkIn',
        params: input.data
      };
    case 'check_out':
      return {
        tool: 'checkin.checkOut',
        params: input.data
      };
    case 'create_tracking':
      return {
        tool: 'checkin.createTracking',
        params: input.data
      };
    case 'get_tracking':
      return {
        tool: 'checkin.getByUser',
        params: [input.userId, input.data || {}]
      };
      
    // RAG System
    case 'rag_chat':
      return {
        tool: 'ragService.chat',
        params: [input.messages, input.userId]
      };
    case 'rag_extract':
      return {
        tool: 'ragService.extract',
        params: [input.messages, input.userId]
      };
    case 'rag_submit':
      return {
        tool: 'rag.submit',
        params: input.data
      };
      
    default:
      console.log('❓ Unknown input type:', input.type);
      return null;
  }
}

module.exports = { decideAction };