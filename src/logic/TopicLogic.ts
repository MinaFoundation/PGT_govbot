import { Op } from "sequelize";
import { EndUserError } from "../Errors";
import { Topic, TopicSMEGroupProposalCreationLimiter, SMEGroup, sequelize, TopicCommittee, SMEGroupMembership } from "../models";
import { TopicAttributes, TopicCommitteeAttributes, TopicCommitteeWithSMEGroup} from "../types";


export class TopicLogic {

  static getByIdOrError(topicId: number): Promise<Topic> {
    return Topic.findByPk(topicId).then((topic) => {

      if (!topic) {
        throw new EndUserError(`Topic with ID ${topicId} not found`);
      }
    
      return topic;
    });
  }

    static async getTotalTopicsCount(): Promise<number> {
        return await Topic.count();
    }

    static async getAllTopics(): Promise<Topic[]> {
        return await Topic.findAll({
            order: [['name', 'ASC']]
        });
    }

    static async getPaginatedTopics(page: number, pageSize: number): Promise<Topic[]> {
        return await Topic.findAll({
            order: [['name', 'ASC']],
            limit: pageSize,
            offset: page * pageSize,
        });
    }

    static async getTopicById(id: number): Promise<Topic | null> {
        return await Topic.findByPk(id);
    }

    static async createTopic(name: string, description: string): Promise<Topic> {
        return await Topic.create({ name, description });
    }

    static async deleteTopic(id: number): Promise<void> {
        const topic = await this.getTopicById(id);
        if (topic) {
            await topic.destroy();
        }
    }

    static async deleteTopicWithDependencies(topicId: number): Promise<void> {
        const topic = await this.getTopicById(topicId);
        if (!topic) {
            throw new EndUserError('Topic not found');
        }

        await Topic.sequelize!.transaction(async (t) => {
            // Remove associated records
            await TopicSMEGroupProposalCreationLimiter.destroy({ where: { topicId: topic.id }, transaction: t });

            // TODO: Add logic to handle other dependencies (e.g., proposals, funding rounds)
            // For example:
            // await Proposal.destroy({ where: { topicId: topic.id }, transaction: t });
            // await FundingRound.destroy({ where: { topicId: topic.id }, transaction: t });

            // Delete the topic itself
            await topic.destroy({ transaction: t });
        });
    }

    static async setAllowedSMEGroups(topicId: number, smeGroupNames: string[]): Promise<void> {
        const topic = await this.getTopicById(topicId);
        if (!topic) {
            throw new EndUserError('Topic not found');
        }

        const smeGroups = await SMEGroup.findAll({
            where: {
                name: smeGroupNames
            }
        });

        if (smeGroups.length !== smeGroupNames.length) {
            const foundNames = smeGroups.map(group => group.name);
            const missingNames = smeGroupNames.filter(name => !foundNames.includes(name));
            throw new EndUserError(`The following SME groups were not found: ${missingNames.join(', ')}`);
        }

        await TopicSMEGroupProposalCreationLimiter.destroy({
            where: { topicId: topic.id }
        });

        for (const smeGroup of smeGroups) {
            await TopicSMEGroupProposalCreationLimiter.create({
                topicId: topic.id,
                smeGroupId: smeGroup.id
            });
        }
    }

    static async updateTopic(topicId: number, name: string, description: string): Promise<void> {
        const topic = await this.getTopicById(topicId);
        if (!topic) {
            throw new EndUserError('Topic not found');
        }

        await topic.update({ name, description });
    }

    static async clearAllowedSMEGroups(topicId: number): Promise<void> {
        const topic = await this.getTopicById(topicId);
        if (!topic) {
            throw new EndUserError('Topic not found');
        }

        await TopicSMEGroupProposalCreationLimiter.destroy({
            where: { topicId: topic.id }
        });
    }

    static async validateSMEGroups(smeGroupNames: string[]): Promise<void> {
        const smeGroups = await SMEGroup.findAll({
            where: {
                name: smeGroupNames
            }
        });

        if (smeGroups.length !== smeGroupNames.length) {
            const foundNames = smeGroups.map(group => group.name);
            const missingNames = smeGroupNames.filter(name => !foundNames.includes(name));
            throw new EndUserError(`The following SME groups were not found: ${missingNames.join(', ')}`);
        }
    }

    static async createTopicWithAllowedGroups(name: string, description: string, smeGroupNames: string[]): Promise<Topic> {
        return await sequelize.transaction(async (t) => {
            const topic = await Topic.create({ name, description }, { transaction: t });

            if (smeGroupNames.length > 0) {
                const smeGroups = await SMEGroup.findAll({
                    where: { name: smeGroupNames },
                    transaction: t
                });

                for (const smeGroup of smeGroups) {
                    await TopicSMEGroupProposalCreationLimiter.create({
                        topicId: topic.id,
                        smeGroupId: smeGroup.id
                    }, { transaction: t });
                }
            }

            return topic;
        });
    }

    static async getTopicDetails(topicId: number): Promise<TopicAttributes & { committees: TopicCommitteeAttributes[] }> {
        const topic = await Topic.findByPk(topicId, {
            include: [
                {
                    model: TopicCommittee,
                    as: 'topicCommittees',
                    include: [{ model: SMEGroup, attributes: ['name'] }]
                }
            ]
        });

        if (!topic) {
            throw new EndUserError('Topic not found');
        }

        const committeesQuery: Promise<TopicCommittee[]> = TopicCommittee.findAll({
            where: { topicId: topic.id },
            include: [{ model: SMEGroup, attributes: ['name'] }]
        });

        let committies = []
        for (const committee of await committeesQuery) {
            const smeGroupName = SMEGroup.findByPk(committee.smeGroupId).then(group => group?.name);
            committies.push({
                id: committee.id,
                topicId: committee.topicId,
                smeGroupId: committee.smeGroupId,
                smeGroupName: smeGroupName,
                numUsers: committee.numUsers
            });
        }

        return {
            id: topic.id,
            name: topic.name,
            description: topic.description,
            committees: committies
        };
    }

    static async getTopicCommittees(topicId: number): Promise<TopicCommitteeWithSMEGroup[]> {
        const committees = await TopicCommittee.findAll({
          where: { topicId }
        });
    
        const result: TopicCommitteeWithSMEGroup[] = [];
    
        for (const committee of committees) {
          const smeGroup = await SMEGroup.findByPk(committee.smeGroupId);
          if (smeGroup) {
            result.push({
              id: committee.id,
              topicId: committee.topicId,
              smeGroupId: committee.smeGroupId,
              smeGroupName: smeGroup.name,
              numUsers: committee.numUsers
            });
          }
        }
    
        return result;
      }
    
      static async addTopicCommittee(topicId: number, smeGroupName: string, numUsers: number): Promise<TopicCommitteeWithSMEGroup> {
        const topic = await Topic.findByPk(topicId);
        if (!topic) {
          throw new EndUserError('Topic not found');
        }
    
        const smeGroup = await SMEGroup.findOne({ where: { name: smeGroupName } });
        if (!smeGroup) {
          throw new EndUserError('SME Group not found');
        }
    
        const existingCommittee = await TopicCommittee.findOne({
          where: { topicId, smeGroupId: smeGroup.id }
        });
    
        if (existingCommittee) {
          throw new EndUserError('A committee for this SME group already exists for this topic');
        }
    
        const committee = await TopicCommittee.create({
          topicId,
          smeGroupId: smeGroup.id,
          numUsers
        });
    
        return {
          id: committee.id,
          topicId: committee.topicId,
          smeGroupId: committee.smeGroupId,
          smeGroupName: smeGroup.name,
          numUsers: committee.numUsers
        };
      }
    
      static async updateTopicCommittee(committeeId: number, numUsers: number): Promise<TopicCommitteeWithSMEGroup> {
        const committee = await TopicCommittee.findByPk(committeeId);
        if (!committee) {
          throw new EndUserError('Committee not found');
        }
    
        const smeGroup = await SMEGroup.findByPk(committee.smeGroupId);
        if (!smeGroup) {
          throw new EndUserError('Associated SME Group not found');
        }
    
        await committee.update({ numUsers });
    
        return {
          id: committee.id,
          topicId: committee.topicId,
          smeGroupId: committee.smeGroupId,
          smeGroupName: smeGroup.name,
          numUsers: committee.numUsers
        };
      }
    
      static async removeTopicCommittee(committeeId: number): Promise<void> {
        const committee = await TopicCommittee.findByPk(committeeId);
        if (!committee) {
          throw new EndUserError('Committee not found');
        }
    
        await committee.destroy();
      }
    
      static async getCommitteeDetails(committeeId: number): Promise<TopicCommitteeWithSMEGroup | null> {
        const committee = await TopicCommittee.findByPk(committeeId);
        if (!committee) {
          return null;
        }
    
        const smeGroup = await SMEGroup.findByPk(committee.smeGroupId);
        if (!smeGroup) {
          throw new EndUserError('Associated SME Group not found');
        }
    
        return {
          id: committee.id,
          topicId: committee.topicId,
          smeGroupId: committee.smeGroupId,
          smeGroupName: smeGroup.name,
          numUsers: committee.numUsers
        };
      }
      
      static async getTopicByName(name: string): Promise<Topic | null> {
        return await Topic.findOne({ where: { name } });
      }

      static async getTopicsForSMEMember(duid: string): Promise<Topic[]> {
        // Find all SME groups the user is a member of
        const memberships = await SMEGroupMembership.findAll({
          where: { duid }
        });

        const smeGroupIds = memberships.map(membership => membership.smeGroupId);

        // Find all topic committees associated with these SME groups
        const committees = await TopicCommittee.findAll({
          where: {
            smeGroupId: {
              [Op.in]: smeGroupIds
            }
          }
        });

        const topicIds = committees.map(committee => committee.topicId);

        // Find and return all topics associated with these committees
        const topics = await Topic.findAll({
          where: {
            id: {
              [Op.in]: topicIds
            }
          }
        });

        return topics;
      }

}