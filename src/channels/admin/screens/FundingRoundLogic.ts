import sequelize from '../../../config/database';
import { FundingRound, Topic, ConsiderationPhase, DeliberationPhase, FundingVotingPhase, SMEGroup, SMEGroupMembership, FundingRoundDeliberationCommitteeSelection } from '../../../models';
import { FundingRoundAttributes, FundingRoundStatus, FundingRoundPhase } from '../../../types';
import { Op, Transaction } from 'sequelize';

export class FundingRoundLogic {
    static async createFundingRound(name: string, description: string, topicName: string, budget: number, votingAddress: string): Promise<FundingRound> {
        const topic = await Topic.findOne({ where: { name: topicName } });
        if (!topic) {
            throw new Error('Topic not found');
        }

        return await FundingRound.create({
            name,
            description,
            topicId: topic.id,
            budget,
            votingAddress,
            status: FundingRoundStatus.DRAFT,
        });
    }

    static async getFundingRoundById(id: number): Promise<FundingRound | null> {
        return await FundingRound.findByPk(id);
    }

    static async getFundingRoundPhase(fundingRoundId: number, phase: string) {
        switch (phase.toLowerCase()) {
            case 'consideration':
                return await ConsiderationPhase.findOne({ where: { fundingRoundId } });
            case 'deliberation':
                return await DeliberationPhase.findOne({ where: { fundingRoundId } });
            case 'voting':
                return await FundingVotingPhase.findOne({ where: { fundingRoundId } });
            default:
                throw new Error(`Invalid phase: ${phase}. Funding Round Id ${fundingRoundId}`);
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

    static async setFundingRoundPhase(fundingRoundId: number, phase: 'consideration' | 'deliberation' | 'voting', startDate: Date, endDate: Date): Promise<void> {
        const fundingRound = await this.getFundingRoundById(fundingRoundId);
        if (!fundingRound) {
            throw new Error('Funding round not found');
        }

        switch (phase.toLocaleLowerCase()) {
            case 'consideration':
                await ConsiderationPhase.upsert({
                    fundingRoundId,
                    startAt: startDate,
                    endAt: endDate,
                });
                break;
            case 'deliberation':
                await DeliberationPhase.upsert({
                    fundingRoundId,
                    startAt: startDate,
                    endAt: endDate,
                });
                break;
            case 'voting':
                await FundingVotingPhase.upsert({
                    fundingRoundId,
                    startAt: startDate,
                    endAt: endDate,
                });
                break;
            default:
                throw new Error('Invalid phase: ' + phase);
        }
    }

    static async getPresentAndFutureFundingRounds(): Promise<FundingRound[]> {
        const currentDate = new Date();
        return await FundingRound.findAll({
            where: {
                [Op.or]: [
                    { endAt: { [Op.gte]: currentDate } },
                    { endAt: null },
                ],
            },
            order: [['startAt', 'ASC']],
        });
    }

    static async updateFundingRound(id: number, updates: Partial<FundingRoundAttributes>): Promise<FundingRound | null> {
        const fundingRound = await this.getFundingRoundById(id);
        if (!fundingRound) {
            return null;
        }

        if (updates.topicId) {
            const topic = await Topic.findByPk(updates.topicId);
            if (!topic) {
                throw new Error('Topic not found');
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
        return memberships.map(membership => membership.duid);
    }

    static async setFundingRoundCommittee(fundingRoundId: number, memberDuids: string[]): Promise<void> {
        const fundingRound = await this.getFundingRoundById(fundingRoundId);
        if (!fundingRound) {
            throw new Error('Funding round not found');
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
            throw new Error('Funding round not found');
        }

        let insertedCount = 0;

        await FundingRound.sequelize!.transaction(async (t: Transaction) => {
            const existingMembers = await FundingRoundDeliberationCommitteeSelection.findAll({
                where: { fundingRoundId },
                transaction: t
            });

            const existingDuids = new Set(existingMembers.map(member => member.duid));

            for (const duid of memberDuids) {
                try {
                    if (!existingDuids.has(duid)) {
                        await FundingRoundDeliberationCommitteeSelection.create(
                            {
                                fundingRoundId,
                                duid: duid,
                            },
                            { transaction: t }
                        );
                        insertedCount++;
                    }
                } catch (error) {
                    console.error('Error in appendFundingRoundCommitteeMembers:', error);

                }
            }
        });

        return insertedCount;
    }

    static async countSMEMembersInDeliberationCommittee(fundingRoundId: number, smeGroupId: number): Promise<number> {
        try {
            const fundingRound = await FundingRound.findByPk(fundingRoundId);
            if (!fundingRound) {
                throw new Error('Funding round not found');
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
                const committeeDuids: string[] = committeeMembers.map(member => member.duid);

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
            console.error('Error in countSMEMembersInDeliberationCommittee:', error);
            throw error;
        }
    }

    static async getFundingRoundCommitteeMembers(fundingRoundId: number): Promise<string[]> {
        const committeeMembers = await FundingRoundDeliberationCommitteeSelection.findAll({
            where: { fundingRoundId },
            attributes: ['duid']
        });

        return committeeMembers.map(member => member.duid);
    }

    static async removeFundingRoundCommitteeMembers(fundingRoundId: number, memberDuids: string[]): Promise<number> {
        const result = await FundingRoundDeliberationCommitteeSelection.destroy({
            where: {
                fundingRoundId,
                duid: memberDuids
            }
        });

        return result;
    }

    static async removeAllFundingRoundCommitteeMembers(fundingRoundId: number): Promise<number> {
        const result = await FundingRoundDeliberationCommitteeSelection.destroy({
            where: {
                fundingRoundId
            }
        });

        return result;
    }

}