// src/channels/consideration/ConsiderationConstants.ts

export const CONSIDERATION_CONSTANTS = {
    SCREEN_IDS: {
      HOME: 'considerationHome',
      SELECT_FUNDING_ROUND: 'selectEligibleFundingRound',
      SELECT_VOTE_TYPE: 'svts', // Select Vote Type Screen
      SELECT_ELIGIBLE_PROJECT: 'selectEligibleProject',
      SELECT_VOTED_PROJECT: 'svps', // Select Voted Project Screen
      SME_CONSIDERATION_VOTE: 'smeConsiderationVote',
    },
  
    ACTION_IDS: {
      SELECT_FUNDING_ROUND: 'selectFundingRound',
      SELECT_VOTE_TYPE: 'svta', // Select Vote Type Action
      SELECT_PROJECT: 'selectProject',
      SME_CONSIDERATION_VOTE: 'smeConsiderationVote',
    },
  
    OPERATION_IDS: {
      SHOW_FUNDING_ROUNDS: 'showFundingRounds',
      SELECT_FUNDING_ROUND: 'selectFundingRound',
      SHOW_VOTE_TYPES: 'showVoteTypes',
      SELECT_VOTE_TYPE: 'svto', // Select Vote Type Operation
      SHOW_PROJECTS: 'showProjects',
      SELECT_PROJECT: 'selectProject',
      SHOW_VOTE_OPTIONS: 'showVoteOptions',
      SUBMIT_VOTE: 'submitVote',
      CONFIRM_VOTE: 'confirmVote',
    },
  
    BUTTON_IDS: {
      SELECT_FUNDING_ROUND: 'selectFundingRoundBtn',
      EVALUATE_NEW_PROPOSALS: 'evaluateNewProposalsBtn',
      UPDATE_PREVIOUS_VOTE: 'updatePreviousVoteBtn',
      APPROVE_PROJECT: 'approveProjectBtn',
      REJECT_PROJECT: 'rejectProjectBtn',
    },
  
    INPUT_IDS: {
      REASON: 'reason',
    },
  
    CUSTOM_ID_ARGS: {
      FUNDING_ROUND_ID: 'fId',
      SHOW_UNVOTED: 'showUnvoted',
      VOTE_TYPE: 'voteType',
      PROJECT_ID: 'pId',
      VOTE: 'vote',
    },
  
    VOTE_OPTIONS: {
      APPROVE: 'approve',
      REJECT: 'reject',
    },
  };