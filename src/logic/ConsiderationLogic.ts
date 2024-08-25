// src/logic/ConsiderationLogic.ts

import { FundingRound, Proposal, SMEConsiderationVoteLog, TopicCommittee, ConsiderationPhase, SMEGroupMembership } from '../models';
import { Op } from 'sequelize';
import { FundingRoundStatus, ProposalStatus } from '../types';
import { EndUserError } from '../Errors';

export class ConsiderationLogic {
    static async getEligibleFundingRounds(userId: string): Promise<FundingRound[]> {
        const now = new Date();
        const userSMEGroups = await SMEGroupMembership.findAll({ where: { duid: userId } });
        const userSMEGroupIds = userSMEGroups.map(membership => membership.smeGroupId);

        const eligibleTopicIds = (await TopicCommittee.findAll({
            where: { smeGroupId: userSMEGroupIds }
        })).map(committee => committee.topicId);

        return await FundingRound.findAll({
            where: {
                topicId: eligibleTopicIds,
                status: FundingRoundStatus.APPROVED,
                startAt: { [Op.lte]: now },
                endAt: { [Op.gt]: now },
            },
            include: [{
                model: ConsiderationPhase,
                as: 'considerationPhase',
                where: {
                    startAt: { [Op.lte]: now },
                    endAt: { [Op.gt]: now },
                },
            }],
        });
    }

    static async getUnvotedProposalsCount(fundingRoundId: number, userId: string): Promise<number> {
        const allProposals = await this.getEligibleProjects(fundingRoundId, userId, true);
        const votedProposalIds = (await SMEConsiderationVoteLog.findAll({
            where: {
                duid: userId,
                proposalId: allProposals.map(p => p.id),
            },
        })).map(log => log.proposalId);

        return allProposals.filter(p => !votedProposalIds.includes(p.id)).length;
    }

    static async getUnvotedProposals(fundingRoundId: number, userId: string): Promise<Proposal[]> {
        return this.getEligibleProjects(fundingRoundId, userId, true);
    }

    static async hasVotedProposals(fundingRoundId: number, userId: string): Promise<boolean> {
        const proposalIds = (await Proposal.findAll({
            where: {
                fundingRoundId,
                status: ProposalStatus.CONSIDERATION_PHASE,
            },
        })).map(p => p.id);

        const voteCount = await SMEConsiderationVoteLog.count({
            where: {
                duid: userId,
                proposalId: proposalIds,
            },
        });

        return voteCount > 0;
    }

    static async getEligibleProjects(fundingRoundId: number, userId: string, showUnvoted: boolean): Promise<Proposal[]> {
        const allProposals = await Proposal.findAll({
            where: {
                fundingRoundId,
                status: ProposalStatus.CONSIDERATION_PHASE,
            },
        });

        const votedProposalIds = (await SMEConsiderationVoteLog.findAll({
            where: {
                duid: userId,
                proposalId: allProposals.map(p => p.id),
            },
        })).map(log => log.proposalId);

        if (showUnvoted) {
            return allProposals.filter(p => !votedProposalIds.includes(p.id));
        } else {
            return allProposals.filter(p => votedProposalIds.includes(p.id));
        }
    }

    static async submitVote(userId: string, projectId: number, fundingRoundId: number, isApprove: boolean, reason: string): Promise<void> {
        const project = await Proposal.findByPk(projectId);
        const fundingRound = await FundingRound.findByPk(fundingRoundId);

        if (!project || !fundingRound) {
            throw new EndUserError('Project or Funding Round not found.');
        }

        if (project.status !== ProposalStatus.CONSIDERATION_PHASE) {
            throw new EndUserError('This project is not in the consideration phase.');
        }

        const considerationPhase = await ConsiderationPhase.findOne({ where: { fundingRoundId } });
        if (!considerationPhase) {
            throw new EndUserError('Consideration phase not found for this funding round.');
        }

        const now = new Date();
        if (now < considerationPhase.startAt || now > considerationPhase.endAt) {
            throw new EndUserError('Consideration phase is not active.');
        }

        await SMEConsiderationVoteLog.create({
            duid: userId,
            proposalId: projectId,
            isPass: isApprove,
            reason: reason,
        });
    }

    static async hasVotedOnProject(duid: string, projectId: number): Promise<boolean> {
        const voteLog = await SMEConsiderationVoteLog.findOne({
            where: { duid, proposalId: projectId },
        });

        return !!voteLog;
    }

    static async mostRecentSMEVote(duid: string, projectId: number): Promise<SMEConsiderationVoteLog | null> {
        return await SMEConsiderationVoteLog.findOne({
            where: {
                duid: duid,
                proposalId: projectId,
            },
            order: [['createdAt', 'DESC']],
        });
    }
}