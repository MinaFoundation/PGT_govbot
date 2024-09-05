import sequelize from '../../../config/database';
import { TrackedInteraction } from '../../../core/BaseClasses';
import { EndUserError } from '../../../Errors';
import logger from '../../../logging';
import {
  FundingRound,
  Topic,
  ConsiderationPhase,
  DeliberationPhase,
  FundingVotingPhase,
  SMEGroup,
  SMEGroupMembership,
  FundingRoundDeliberationCommitteeSelection,
  FundingRoundApprovalVote,
  TopicSMEGroupProposalCreationLimiter,
  Proposal,
  TopicCommittee,
} from '../../../models';
import { FundingRoundMI, FundingRoundMIPhase, FundingRoundMIPhaseValue } from '../../../models/Interface';
import { FundingRoundAttributes, FundingRoundStatus, FundingRoundPhase, ProposalStatus } from '../../../types';
import { Op, Transaction } from 'sequelize';

export class FundingRoundLogic {
  static async createFundingRound(
    name: string,
    description: string,
    topicName: string,
    budget: number,
    stakingLedgerEpoch: number,
  ): Promise<FundingRound> {
    const topic = await Topic.findOne({ where: { name: topicName } });
    if (!topic) {
      throw new EndUserError('Topic not found');
    }

    return await FundingRound.create({
      name,
      description,
      topicId: topic.id,
      budget,
      votingAddress: null,
      stakingLedgerEpoch,
      status: FundingRoundStatus.VOTING,
    });
  }

  static async newFundingRoundFromCoreInfo(
    name: string,
    description: string,
    topicId: number,
    budget: number,
    stakingLedgerEpoch: number,
  ): Promise<FundingRound> {
    return await FundingRound.create({
      name,
      description,
      topicId,
      budget,
      stakingLedgerEpoch,
      status: FundingRoundStatus.VOTING,
    });
  }

  static async getFundingRoundById(id: number): Promise<FundingRound | null> {
    return await FundingRound.findByPk(id);
  }

  static async getFundingRoundByIdOrError(fundingRoundId: number): Promise<FundingRound> {
    const fundingRound = await this.getFundingRoundById(fundingRoundId);
    if (!fundingRound) {
      throw new EndUserError(`Funding round with id ${fundingRoundId} not found`);
    }

    return fundingRound;
  }

  static async getFundingRoundPhase(fundingRoundId: number, phase: FundingRoundMIPhaseValue) {
    switch (phase) {
      case FundingRoundMI.PHASES.CONSIDERATION:
        return await ConsiderationPhase.findOne({ where: { fundingRoundId } });
      case FundingRoundMI.PHASES.DELIBERATION:
        return await DeliberationPhase.findOne({ where: { fundingRoundId } });
      case FundingRoundMI.PHASES.VOTING:
        return await FundingVotingPhase.findOne({ where: { fundingRoundId } });
      default:
        throw new EndUserError(`Invalid phase: ${phase}. Funding Round Id ${fundingRoundId}`);
    }
  }

  static async getFundingRoundPhases(fundingRoundId: number): Promise<FundingRoundPhase[]> {
    const considerationPhase = await ConsiderationPhase.findOne({ where: { fundingRoundId } });
    const deliberationPhase = await DeliberationPhase.findOne({ where: { fundingRoundId } });
    const votingPhase = await FundingVotingPhase.findOne({ where: { fundingRoundId } });

    const phases: FundingRoundPhase[] = [];

    if (considerationPhase) {
      phases.push({
        phase: 'consideration',
        startDate: considerationPhase.startAt,
        endDate: considerationPhase.endAt,
      });
    }

    if (deliberationPhase) {
      phases.push({
        phase: 'deliberation',
        startDate: deliberationPhase.startAt,
        endDate: deliberationPhase.endAt,
      });
    }

    if (votingPhase) {
      phases.push({
        phase: 'voting',
        startDate: votingPhase.startAt,
        endDate: votingPhase.endAt,
      });
    }

    return phases;
  }

  static async getCurrentPhase(fundingRoundId: number): Promise<FundingRoundPhase | null> {
    const currentPhases: FundingRoundPhase[] = await this.getFundingRoundPhases(fundingRoundId);
    if (currentPhases.length === 0) {
      return null;
    }

    if (currentPhases.length > 1) {
      logger.warn(
        `Funding round ${fundingRoundId} has multiple active phases: ${currentPhases
          .map((phase) => phase.phase)
          .join(', ')}. Defaulting to the first one.`,
      );
    }

    return currentPhases[0];
  }

  static async setFundingRoundPhase(
    fundingRoundId: number,
    phase: FundingRoundMIPhaseValue,
    stakingLedgerEpoch: number,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    const fundingRound = await this.getFundingRoundByIdOrError(fundingRoundId);

    await this.validateFundingRoundPhaseDatesOrError(fundingRoundId, phase, startDate, endDate);

    switch (phase.toString().toLocaleLowerCase()) {
      case FundingRoundMI.PHASES.CONSIDERATION.toString().toLocaleLowerCase():
        await ConsiderationPhase.upsert({
          fundingRoundId,
          stakingLedgerEpoch,
          startAt: startDate,
          endAt: endDate,
        });
        break;
      case FundingRoundMI.PHASES.DELIBERATION.toString().toLocaleLowerCase():
        await DeliberationPhase.upsert({
          fundingRoundId,
          stakingLedgerEpoch,
          startAt: startDate,
          endAt: endDate,
        });
        break;
      case FundingRoundMI.PHASES.VOTING.toString().toLocaleLowerCase():
        await FundingVotingPhase.upsert({
          fundingRoundId,
          stakingLedgerEpoch,
          startAt: startDate,
          endAt: endDate,
        });
        break;
      case FundingRoundMI.PHASES.ROUND.toString().toLocaleLowerCase():
        await fundingRound.update({
          startAt: startDate,
          endAt: endDate,
        });
        break;
      default:
        throw new EndUserError('Invalid phase: ' + phase);
    }
  }

  static async getPresentAndFutureFundingRounds(): Promise<FundingRound[]> {
    const currentDate = new Date();
    return await FundingRound.findAll({
      where: {
        [Op.or]: [{ endAt: { [Op.gte]: currentDate } }, { endAt: null }],
      },
      order: [['startAt', 'ASC']],
    });
  }

  static async updateFundingRound(id: number, updates: Partial<FundingRoundAttributes>): Promise<FundingRound> {
    const fundingRound = await this.getFundingRoundByIdOrError(id);

    if (updates.topicId) {
      const topic = await Topic.findByPk(updates.topicId);
      if (!topic) {
        throw new EndUserError('Topic not found');
      }
    }

    await fundingRound.update(updates);
    return fundingRound;
  }

  static async approveFundingRound(id: number): Promise<FundingRound | null> {
    const fundingRound = await this.getFundingRoundById(id);
    if (!fundingRound) {
      return null;
    }

    await fundingRound.update({ status: FundingRoundStatus.APPROVED });
    return fundingRound;
  }

  static async rejectFundingRound(id: number): Promise<FundingRound | null> {
    const fundingRound = await this.getFundingRoundById(id);
    if (!fundingRound) {
      return null;
    }

    await fundingRound.update({ status: FundingRoundStatus.REJECTED });
    return fundingRound;
  }

  static async getSMEGroupMemberCount(smeGroupId: number): Promise<number> {
    return await SMEGroupMembership.count({ where: { smeGroupId } });
  }

  static async getSMEGroupMembers(smeGroupId: number): Promise<string[]> {
    const memberships = await SMEGroupMembership.findAll({ where: { smeGroupId } });
    return memberships.map((membership) => membership.duid);
  }

  static async setFundingRoundCommittee(fundingRoundId: number, memberDuids: string[]): Promise<void> {
    const fundingRound = await this.getFundingRoundById(fundingRoundId);
    if (!fundingRound) {
      throw new EndUserError('Funding round not found');
    }

    await FundingRoundDeliberationCommitteeSelection.destroy({ where: { fundingRoundId } });

    for (const duid of memberDuids) {
      await FundingRoundDeliberationCommitteeSelection.create({
        fundingRoundId,
        duid: duid,
      });
    }
  }

  static async appendFundingRoundCommitteeMembers(fundingRoundId: number, memberDuids: string[]): Promise<number> {
    const fundingRound = await this.getFundingRoundById(fundingRoundId);
    if (!fundingRound) {
      throw new EndUserError('Funding round not found');
    }

    let insertedCount = 0;

    await FundingRound.sequelize!.transaction(async (t: Transaction) => {
      const existingMembers = await FundingRoundDeliberationCommitteeSelection.findAll({
        where: { fundingRoundId },
        transaction: t,
      });

      const existingDuids = new Set(existingMembers.map((member) => member.duid));

      for (const duid of memberDuids) {
        try {
          if (!existingDuids.has(duid)) {
            await FundingRoundDeliberationCommitteeSelection.create(
              {
                fundingRoundId,
                duid: duid,
              },
              { transaction: t },
            );
            insertedCount++;
          }
        } catch (error) {
          logger.error('Error in appendFundingRoundCommitteeMembers:', error);
          throw new EndUserError('Error in appendFundingRoundCommitteeMembers', error);
        }
      }
    });

    return insertedCount;
  }

  static async countSMEMembersInDeliberationCommittee(fundingRoundId: number, smeGroupId: number): Promise<number> {
    try {
      const fundingRound = await FundingRound.findByPk(fundingRoundId);
      if (!fundingRound) {
        throw new EndUserError('Funding round not found');
      }

      const count = await sequelize.transaction(async (t) => {
        // First, get all committee members for the funding round
        const committeeMembers = await FundingRoundDeliberationCommitteeSelection.findAll({
          where: { fundingRoundId },
          attributes: ['duid'],
          transaction: t,
        });

        if (committeeMembers.length === 0) {
          return 0; // No committee members selected for this funding round
        }

        // Get the duids of all committee members
        const committeeDuids: string[] = committeeMembers.map((member) => member.duid);

        // Now, count how many of these duids are in the specified SME group
        const smeMembersCount = await SMEGroupMembership.count({
          where: {
            smeGroupId: smeGroupId,
            duid: committeeDuids,
          },
          transaction: t,
        });

        const allSMEGroupMembers = await SMEGroupMembership.findAll({
          where: { smeGroupId },
          attributes: ['duid'],
          transaction: t,
        });

        return smeMembersCount;
      });

      return count;
    } catch (error) {
      logger.error('Error in countSMEMembersInDeliberationCommittee:', error);
      throw new EndUserError('Error in countSMEMembersInDeliberationCommittee', error);
    }
  }

  static async getFundingRoundCommitteeMembers(fundingRoundId: number): Promise<string[]> {
    const committeeMembers = await FundingRoundDeliberationCommitteeSelection.findAll({
      where: { fundingRoundId },
      attributes: ['duid'],
    });

    return committeeMembers.map((member) => member.duid);
  }

  static async removeFundingRoundCommitteeMembers(fundingRoundId: number, memberDuids: string[]): Promise<number> {
    const result = await FundingRoundDeliberationCommitteeSelection.destroy({
      where: {
        fundingRoundId,
        duid: memberDuids,
      },
    });

    return result;
  }

  static async removeAllFundingRoundCommitteeMembers(fundingRoundId: number): Promise<number> {
    const result = await FundingRoundDeliberationCommitteeSelection.destroy({
      where: {
        fundingRoundId,
      },
    });

    return result;
  }

  static async createDraftFundingRound(
    topicId: number,
    name: string,
    description: string,
    budget: number,
    stakingLedgerEpoch: number,
    votingOpenUntil: Date,
  ): Promise<FundingRound> {
    return await FundingRound.create({
      topicId,
      name,
      description,
      budget,
      votingAddress: null,
      stakingLedgerEpoch,
      votingOpenUntil,
      status: FundingRoundStatus.VOTING,
    });
  }

  static async getEligibleVotingRounds(interaction: TrackedInteraction): Promise<FundingRound[]> {
    const duid: string = interaction.discordUserId;
    const now = new Date();

    const userFundingRounds = await FundingRoundLogic.getFundingRoundsForUser(duid);

    const eligibleFundingRounds = userFundingRounds.filter((fr) => fr.status === FundingRoundStatus.VOTING && fr.votingOpenUntil >= now);

    const readyFundingRounds = await Promise.all(
      eligibleFundingRounds.map(async (fr) => ({
        fundingRound: fr,
        isReady: await fr.isReady(),
      })),
    );

    return readyFundingRounds.filter(({ isReady }) => isReady).map(({ fundingRound }) => fundingRound);
  }

  static async hasUserVotedOnFundingRound(userId: string, fundingRoundId: number): Promise<boolean> {
    const vote = await FundingRoundApprovalVote.findOne({
      where: {
        duid: userId,
        fundingRoundId,
      },
    });
    return !!vote;
  }

  static async voteFundingRound(userId: string, fundingRoundId: number): Promise<void> {
    const fundingRound = await this.getFundingRoundById(fundingRoundId);
    if (!fundingRound) {
      throw new EndUserError('Funding round not found');
    }

    if (fundingRound.status !== FundingRoundStatus.VOTING) {
      throw new EndUserError('This funding round is not open for voting');
    }

    if (fundingRound.votingOpenUntil < new Date()) {
      throw new EndUserError('Voting period for this funding round has ended');
    }

    await FundingRoundApprovalVote.upsert({
      duid: userId,
      fundingRoundId,
      isPass: true,
    });
  }

  static async unvoteFundingRound(userId: string, fundingRoundId: number): Promise<void> {
    const fundingRound: FundingRound | null = await this.getFundingRoundById(fundingRoundId);

    if (!fundingRound) {
      throw new EndUserError('Funding round not found');
    }

    if (fundingRound.status !== FundingRoundStatus.VOTING) {
      throw new EndUserError('This funding round is not open for voting');
    }

    if (fundingRound.votingOpenUntil < new Date()) {
      throw new EndUserError('Voting period for this funding round has ended');
    }

    await FundingRoundApprovalVote.upsert({
      duid: userId,
      fundingRoundId,
      isPass: false,
    });
  }

  static async getLatestVote(userId: string, fundingRoundId: number): Promise<FundingRoundApprovalVote | null> {
    return await FundingRoundApprovalVote.findOne({
      where: {
        duid: userId,
        fundingRoundId,
      },
      order: [['createdAt', 'DESC']],
    });
  }

  static async canChangeVote(userId: string, fundingRoundId: number): Promise<boolean> {
    const fundingRound = await this.getFundingRoundById(fundingRoundId);
    if (!fundingRound) {
      throw new EndUserError('Funding round not found');
    }

    if (fundingRound.status !== FundingRoundStatus.VOTING) {
      return false;
    }

    if (fundingRound.votingOpenUntil < new Date()) {
      return false;
    }

    return true;
  }

  static async createApproveVote(userId: string, fundingRoundId: number, reason: string): Promise<void> {
    if (!(await this.canChangeVote(userId, fundingRoundId))) {
      throw new EndUserError('Voting is not allowed at this time');
    }

    await FundingRoundApprovalVote.create({
      duid: userId,
      fundingRoundId,
      isPass: true,
      reason,
    });
  }

  static async createRejectVote(userId: string, fundingRoundId: number, reason: string): Promise<void> {
    if (!(await this.canChangeVote(userId, fundingRoundId))) {
      throw new EndUserError('Voting is not allowed at this time');
    }

    await FundingRoundApprovalVote.create({
      duid: userId,
      fundingRoundId,
      isPass: false,
      reason,
    });
  }

  static async getEligibleFundingRoundsForProposal(proposalId: number, userId: string): Promise<FundingRound[]> {
    const proposal: Proposal | null = await Proposal.findByPk(proposalId);
    if (!proposal) {
      throw new EndUserError('Proposal not found');
    }

    const now: Date = new Date();
    const eligibleFundingRounds: FundingRound[] = await FundingRound.findAll({
      where: {
        status: FundingRoundStatus.APPROVED,
        startAt: { [Op.lte]: now },
        endAt: { [Op.gt]: now },
      },

      include: [
        {
          model: ConsiderationPhase,
          where: {
            startAt: { [Op.lte]: now },
            endAt: { [Op.gt]: now },
          },
          as: 'considerationPhase',
        },
      ],
    });

    const userSMEGroups: SMEGroupMembership[] = await SMEGroupMembership.findAll({
      where: { duid: userId },
    });

    const userSMEGroupIds: number[] = userSMEGroups.map((membership) => membership.smeGroupId);

    return eligibleFundingRounds.filter(async (fundingRound: FundingRound) => {
      const limitations: TopicSMEGroupProposalCreationLimiter[] = await TopicSMEGroupProposalCreationLimiter.findAll({
        where: { topicId: fundingRound.topicId },
      });

      if (limitations.length === 0) {
        return true;
      }

      const allowedSMEGroupIds: number[] = limitations.map((limitation) => limitation.smeGroupId);
      return userSMEGroupIds.some((id) => allowedSMEGroupIds.includes(id));
    });
  }

  static async getFundingRoundsWithUserProposals(duid: string): Promise<FundingRound[]> {
    const userProposals: Proposal[] = await Proposal.findAll({
      where: { proposerDuid: duid },
      attributes: ['fundingRoundId'],
      group: ['fundingRoundId'],
    });

    const fundingRoundIds: (number | null)[] = userProposals.map((proposal) => proposal.fundingRoundId);

    return FundingRound.findAll({
      where: {
        id: {
          [Op.in]: fundingRoundIds.filter((id): id is number => id !== null),
        },
      },
      order: [['endAt', 'DESC']],
    });
  }

  static async isProposalActiveForFundingRound(proposal: Proposal, fundingRound: FundingRound): Promise<boolean> {
    const now: Date = new Date();

    if (fundingRound.status !== FundingRoundStatus.APPROVED) {
      return false;
    }

    if (proposal.status === ProposalStatus.CANCELLED || proposal.status === ProposalStatus.DRAFT) {
      return false;
    }

    const considerationPhase: ConsiderationPhase | null = await ConsiderationPhase.findOne({
      where: { fundingRoundId: fundingRound.id },
    });

    const deliberationPhase: DeliberationPhase | null = await DeliberationPhase.findOne({
      where: { fundingRoundId: fundingRound.id },
    });

    const fundingVotingPhase: FundingVotingPhase | null = await FundingVotingPhase.findOne({
      where: { fundingRoundId: fundingRound.id },
    });

    if (considerationPhase && now >= considerationPhase.startAt && now <= considerationPhase.endAt) {
      return proposal.status === ProposalStatus.CONSIDERATION_PHASE;
    }

    if (deliberationPhase && now >= deliberationPhase.startAt && now <= deliberationPhase.endAt) {
      return proposal.status === ProposalStatus.DELIBERATION_PHASE;
    }

    if (fundingVotingPhase && now >= fundingVotingPhase.startAt && now <= fundingVotingPhase.endAt) {
      return proposal.status === ProposalStatus.FUNDING_VOTING_PHASE;
    }

    return false;
  }

  static async getProposalsWithActivityStatus(fundingRoundId: number): Promise<{ proposal: Proposal; isActive: boolean }[]> {
    const fundingRound: FundingRound | null = await FundingRound.findByPk(fundingRoundId);
    if (!fundingRound) {
      throw new EndUserError('Funding round not found');
    }

    const proposals: Proposal[] = await Proposal.findAll({
      where: { fundingRoundId },
    });

    const result: { proposal: Proposal; isActive: boolean }[] = [];

    for (const proposal of proposals) {
      const isActive: boolean = await this.isProposalActiveForFundingRound(proposal, fundingRound);
      result.push({ proposal, isActive });
    }

    return result;
  }

  static async getActiveFundingRoundPhases(fundingRoundId: number): Promise<string[]> {
    const fundingRound = await this.getFundingRoundById(fundingRoundId);
    if (!fundingRound) {
      throw new EndUserError('Funding round not found');
    }

    const now = new Date();
    const activePhases: string[] = [];

    const considerationPhase = await ConsiderationPhase.findOne({ where: { fundingRoundId } });
    if (considerationPhase && now >= considerationPhase.startAt && now <= considerationPhase.endAt) {
      activePhases.push('consideration');
    }

    const deliberationPhase = await DeliberationPhase.findOne({ where: { fundingRoundId } });
    if (deliberationPhase && now >= deliberationPhase.startAt && now <= deliberationPhase.endAt) {
      activePhases.push('deliberation');
    }

    const fundingVotingPhase = await FundingVotingPhase.findOne({ where: { fundingRoundId } });
    if (fundingVotingPhase && now >= fundingVotingPhase.startAt && now <= fundingVotingPhase.endAt) {
      activePhases.push('funding');
    }

    return activePhases;
  }

  static async getActiveProposalsForPhase(fundingRoundId: number, phase: string): Promise<Proposal[]> {
    const fundingRound = await this.getFundingRoundById(fundingRoundId);
    if (!fundingRound) {
      throw new EndUserError('Funding round not found');
    }

    let status: ProposalStatus;
    switch (phase.toLowerCase()) {
      case 'consideration':
        status = ProposalStatus.CONSIDERATION_PHASE;
        break;
      case 'deliberation':
        status = ProposalStatus.DELIBERATION_PHASE;
        break;
      case 'funding':
        status = ProposalStatus.FUNDING_VOTING_PHASE;
        break;
      default:
        throw new EndUserError('Invalid phase');
    }
    return await Proposal.findAll({
      where: {
        fundingRoundId,
        status,
      },
    });
  }

  static async getVotingAndApprovedFundingRounds(): Promise<FundingRound[]> {
    const now = new Date();
    return await FundingRound.findAll({
      where: {
        [Op.or]: [
          {
            status: FundingRoundStatus.VOTING,
            votingOpenUntil: {
              [Op.gte]: now,
            },
          },
          {
            status: FundingRoundStatus.APPROVED,
            endAt: {
              [Op.gt]: now,
            },
            startAt: {
              [Op.lte]: now,
            },
          },
        ],
      },
      include: [
        { model: ConsiderationPhase, required: true, as: 'considerationPhase' },
        { model: DeliberationPhase, required: true, as: 'deliberationPhase' },
        { model: FundingVotingPhase, required: true, as: 'fundingVotingPhase' },
      ],
    });
  }

  static async getActiveFundingRounds(): Promise<FundingRound[]> {
    const now = new Date();
    return await FundingRound.findAll({
      where: {
        [Op.or]: [
          { status: FundingRoundStatus.VOTING },
          {
            status: FundingRoundStatus.APPROVED,
            startAt: { [Op.lte]: now },
            endAt: { [Op.gte]: now },
          },
        ],
      },
      order: [['createdAt', 'DESC']],
    });
  }

  static async validateFundingRoundDatesOrError(
    fundingRoundId: number,
    newStartDate: Date,
    newEndDate: Date,
    newVotingOpenUntil?: Date,
  ): Promise<void> {
    const phases = await this.getFundingRoundPhases(fundingRoundId);

    if (newStartDate >= newEndDate) {
      throw new EndUserError('Start date must be before end date.');
    }

    if (newVotingOpenUntil && newVotingOpenUntil >= newStartDate) {
      throw new EndUserError(
        `Voting open until date must be before start date, and ${newVotingOpenUntil.toUTCString()} >= ${newStartDate.toUTCString()}`,
      );
    }

    for (let i = 0; i < phases.length; i++) {
      if (phases[i].startDate < newStartDate || phases[i].endDate > newEndDate) {
        throw new EndUserError(
          `${phases[i].phase} phase must be within funding round dates, and ${phases[
            i
          ].startDate.toUTCString()} < ${newStartDate.toUTCString()} or ${phases[i].endDate.toUTCString()} > ${newEndDate.toUTCString()}`,
        );
      }

      if (i > 0 && phases[i].startDate <= phases[i - 1].endDate) {
        throw new EndUserError(
          `${phases[i].phase} phase must start after ${phases[i - 1].phase} phase ends, and ${phases[i].startDate.toUTCString()} <= ${phases[
            i - 1
          ].endDate.toUTCString()}`,
        );
      }
    }
  }

  static async validateFundingRoundPhaseDatesOrError(
    fundingRoundId: number,
    phase: FundingRoundMIPhaseValue,
    newStartDate: Date,
    newEndDate: Date,
  ): Promise<void> {
    const fundingRound: FundingRound = await this.getFundingRoundByIdOrError(fundingRoundId);
    if (newStartDate >= newEndDate) {
      throw new EndUserError(`Start date must be before end date, and ${newStartDate} >= ${newEndDate}`);
    }

    if (fundingRound.startAt && newStartDate <= fundingRound.startAt) {
      throw new EndUserError(
        `Start date must be after funding round start date, and ${newStartDate.toUTCString()} <= ${fundingRound.startAt.toUTCString()}`,
      );
    }

    if (fundingRound.endAt && newEndDate >= fundingRound.endAt) {
      throw new EndUserError(
        `End date must be before funding round end date, and ${newEndDate.toUTCString()} >= ${fundingRound.endAt.toUTCString()}`,
      );
    }

    if (phase === FundingRoundMI.PHASES.CONSIDERATION) {
      logger.debug(`Validating consideration phase dates for funding round ${fundingRoundId}...`);

      // Ensure that the consideration phase ends before the Debliberation phase starts
      const deliberationPhase = await this.getFundingRoundPhase(fundingRoundId, FundingRoundMI.PHASES.DELIBERATION);

      if (deliberationPhase) {
        logger.debug(`\tChecking deliberation phase...`);
        if (newEndDate >= deliberationPhase.startAt) {
          throw new EndUserError('Consideration phase must end before deliberation phase starts.');
        }
      }

      // Ensure that the consideration ends (and starts) before the Voting phase starts
      const votingPhase = await this.getFundingRoundPhase(fundingRoundId, FundingRoundMI.PHASES.VOTING);

      if (votingPhase) {
        logger.debug(`\tChecking voting phase...`);
        if (newEndDate >= votingPhase.startAt) {
          throw new EndUserError(
            `Consideration phase must end before voting phase starts, and ${newEndDate.toUTCString()} >= ${votingPhase.startAt.toUTCString()}`,
          );
        }
      }
    } else if (phase === FundingRoundMI.PHASES.DELIBERATION) {
      logger.debug(`Validating deliberation phase dates for funding round ${fundingRoundId}...`);
      // Esnure that the deliberation phase starts and ends after the Consideration phase ends
      const considerationPhase = await this.getFundingRoundPhase(fundingRoundId, FundingRoundMI.PHASES.CONSIDERATION);

      if (considerationPhase) {
        logger.debug(`\tChecking consideration phase...`);
        if (newStartDate <= considerationPhase.endAt) {
          throw new EndUserError('Deliberation phase must start after consideration phase ends.');
        }
      }

      // Ensure that the deliberation phase starts and ends before the Voting phase starts
      const votingPhase = await this.getFundingRoundPhase(fundingRoundId, FundingRoundMI.PHASES.VOTING);

      if (votingPhase) {
        logger.debug(`\tChecking voting phase...`);
        if (newEndDate >= votingPhase.startAt) {
          throw new EndUserError('Deliberation phase must end before voting phase starts.');
        }
      }
    } else if (phase === FundingRoundMI.PHASES.VOTING) {
      logger.debug(`Validating voting phase dates for funding round ${fundingRoundId}...`);
      // 1. Ensure that the voting phase starts and ends after the Consideration phase ends
      const considerationPhase = await this.getFundingRoundPhase(fundingRoundId, FundingRoundMI.PHASES.CONSIDERATION);

      if (considerationPhase) {
        logger.debug(`\tChecking consideration phase...`);
        if (newStartDate <= considerationPhase.endAt) {
          throw new EndUserError('Voting phase must start after consideration phase ends.');
        }
      }

      // 2. Ensure that the voting phase starts and ends after the Deliberation phase ends
      const deliberationPhase = await this.getFundingRoundPhase(fundingRoundId, FundingRoundMI.PHASES.DELIBERATION);

      if (deliberationPhase) {
        logger.debug(`\tChecking deliberation phase...`);
        if (newStartDate <= deliberationPhase.endAt) {
          throw new EndUserError('Voting phase must start after deliberation phase ends.');
        }
      }
    }
  }

  static async updateFundingRoundDates(fundingRoundId: number, startAt: Date, endAt: Date, votingOpenUntil?: Date): Promise<FundingRound> {
    const fundingRound = await this.getFundingRoundByIdOrError(fundingRoundId);

    await this.validateFundingRoundDatesOrError(fundingRoundId, startAt, endAt, votingOpenUntil);

    await fundingRound.update({ startAt, endAt, votingOpenUntil });
    return fundingRound;
  }

  static async updateFundingRoundVoteData(
    fundingRoundId: number,
    startAt: Date,
    endAt: Date,
    votingOpenUntil: Date,
    stakingLedgerEpoch: number,
  ): Promise<FundingRound> {
    const fundingRound: FundingRound = await this.updateFundingRoundDates(fundingRoundId, startAt, endAt, votingOpenUntil);
    await fundingRound.update({ stakingLedgerEpoch });
    return fundingRound;
  }

  static async updateFundingRoundPhase(
    fundingRoundId: number,
    phase: 'consideration' | 'deliberation' | 'voting' | 'round',
    stakingLedgerEpoch: number,
    startDate: Date,
    endDate: Date,
  ): Promise<FundingRound> {
    const fundingRound = await this.getFundingRoundByIdOrError(fundingRoundId);

    if (phase === FundingRoundMI.PHASES.ROUND) {
      return await this.updateFundingRoundDates(fundingRoundId, startDate, endDate, fundingRound.votingOpenUntil);
    }

    await this.setFundingRoundPhase(fundingRoundId, phase, stakingLedgerEpoch, startDate, endDate);
    return fundingRound;
  }

  static async setTopic(fundingRoundId: number, topicId: number): Promise<FundingRound> {
    const { TopicLogic } = await import('../../../logic/TopicLogic');

    const fundingRound = await this.getFundingRoundByIdOrError(fundingRoundId);
    const topic = await TopicLogic.getByIdOrError(topicId);

    return await fundingRound.update({ topicId: topic.id });
  }

  static async getFundingRoundsForUser(duid: string): Promise<FundingRound[]> {
    // Get all SMEGroups the user belongs to
    const userSMEGroups = await SMEGroupMembership.findAll({
      where: { duid },
      attributes: ['smeGroupId'],
    });

    const userSMEGroupIds = userSMEGroups.map((group) => group.smeGroupId);

    // Find all TopicCommittees associated with the user's SMEGroups
    const relevantTopicCommittees = await TopicCommittee.findAll({
      where: {
        smeGroupId: {
          [Op.in]: userSMEGroupIds,
        },
      },
      attributes: ['topicId'],
    });

    const relevantTopicIds = relevantTopicCommittees.map((committee) => committee.topicId);

    // Find all FundingRounds associated with these Topics
    const fundingRounds = await FundingRound.findAll({
      where: {
        topicId: {
          [Op.in]: relevantTopicIds,
        },
      },
      include: [
        {
          model: Topic,
          as: 'topic',
        },
      ],
    });

    return fundingRounds;
  }

  public static async getAllFundingRounds(): Promise<FundingRound[]> {
    return await FundingRound.findAll({
      order: [['createdAt', 'DESC']],
    });
  }

  static async getProposalsForFundingRound(fundingRoundId: number): Promise<Proposal[]> {
    const fundingRound = await this.getFundingRoundByIdOrError(fundingRoundId);

    return await Proposal.findAll({
      where: { fundingRoundId: fundingRound.id },
      order: [['createdAt', 'ASC']],
    });
  }
}
