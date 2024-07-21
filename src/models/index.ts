import { Sequelize, DataTypes, Model } from 'sequelize';
import {
  UserAttributes,
  UserCreationAttributes,
  SMEGroupAttributes,
  AdminUserAttributes,
  AdminUserCreationAttributes,
  UserPublicKeyAttributes,
  UserPublicKeyCreationAttributes,
  TopicAttributes,
  TopicCreationAttributes,
  TopicCommitteeAttributes,
  TopicCommitteeCreationAttributes,
  FundingRoundConsiderationVoteAllowedSMEGroupsAttributes,
  FundingRoundConsiderationVoteAllowedSMEGroupsCreationAttributes,
  TopicSMEGroupProposalCreationLimiterAttributes,
  TopicSMEGroupProposalCreationLimiterCreationAttributes,
  FundingRoundAttributes,
  FundingRoundCreationAttributes,
  ConsiderationPhaseAttributes,
  ConsiderationPhaseCreationAttributes,
  DeliberationPhaseAttributes,
  DeliberationPhaseCreationAttributes,
  FundingVotingPhaseAttributes,
  FundingVotingPhaseCreationAttributes,
  ProposalAttributes,
  ProposalCreationAttributes,
  FundingRoundDeliberationCommitteeSelectionAttributes,
  FundingRoundDeliberationCommitteeSelectionCreationAttributes,
  SMEConsiderationVoteLogAttributes,
  SMEConsiderationVoteLogCreationAttributes,
  GPTSummarizerVoteLogAttributes,
  GPTSummarizerVoteLogCreationAttributes,
  CommitteeDeliberationVoteLogAttributes,
  CommitteeDeliberationVoteLogCreationAttributes,
  CommitteeDeliberationProjectSelectionAttributes,
  CommitteeDeliberationProjectSelectionCreationAttributes,
  FundingRoundApprovalVoteAttributes,
  FundingRoundApprovalVoteCreationAttributes,
  ProposalStatus,
  CommitteeDeliberationVoteChoice,
  FundingRoundStatus,
  SMEGroupCreationAttributes,
  SMEGroupMembershipAttributes,
  SMEGroupMembershipCreationAttributes,
} from '../types';

const sequelize: Sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'database.sqlite',
  logging: false,
});

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public duid!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    duid: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
  },
  {
    sequelize,
    tableName: 'users',
  }
);

class SMEGroup extends Model<SMEGroupAttributes, SMEGroupCreationAttributes> implements SMEGroupAttributes {
  public id!: number;
  public name!: string;
  public description!: string;
}

SMEGroup.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'sme_groups',
  }
);


class SMEGroupMembership extends Model<SMEGroupMembershipAttributes, SMEGroupMembershipCreationAttributes> implements SMEGroupMembershipAttributes {
  public id!: number;
  public smeGroupId!: number;
  public duid!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SMEGroupMembership.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    smeGroupId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: SMEGroup,
        key: 'id',
      },
    },
    duid: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'sme_group_memberships',
    indexes: [
      {
        unique: true,
        fields: ['smeGroupId', 'duid'],
      },
    ],
  }
); 

class AdminUser extends Model<AdminUserAttributes, AdminUserCreationAttributes> implements AdminUserAttributes {
  public id!: number;
  public duid!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AdminUser.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    duid: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
  },
  {
    sequelize,
    tableName: 'admin_users',
  }
);

class UserPublicKey extends Model<UserPublicKeyAttributes, UserPublicKeyCreationAttributes> implements UserPublicKeyAttributes {
  public id!: number;
  public duid!: number;
  public publicKey!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

UserPublicKey.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    duid: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    publicKey: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'user_public_keys',
  }
);

class Topic extends Model<TopicAttributes, TopicCreationAttributes> implements TopicAttributes {
  public id!: number;
  public name!: string;
  public description!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Topic.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'topics',
  }
);

class TopicCommittee extends Model<TopicCommitteeAttributes, TopicCommitteeCreationAttributes> implements TopicCommitteeAttributes {
  public id!: number;
  public topicId!: number;
  public smeGroupId!: number;
  public numUsers!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

TopicCommittee.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    topicId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Topic,
        key: 'id',
      },
    },
    smeGroupId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: SMEGroup,
        key: 'id',
      },
    },
    numUsers: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'topic_committees',
    indexes: [
      {
        unique: true,
        fields: ['topicId', 'smeGroupId'],
      },
    ],
  }
);

class FundingRound extends Model<FundingRoundAttributes, FundingRoundCreationAttributes> implements FundingRoundAttributes {
  public id!: number;
  public name!: string;
  public description!: string;
  public topicId!: number;
  public budget!: number;
  public votingAddress!: string;
  public status!: FundingRoundStatus;
  public votingOpenUntil!: Date;
  public startAt!: Date;
  public endAt!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

FundingRound.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    topicId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Topic,
        key: 'id',
      },
    },
    budget: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    votingAddress: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(FundingRoundStatus) as string[]),
      allowNull: false,
      defaultValue: FundingRoundStatus.DRAFT,
    },
    votingOpenUntil: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    startAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'funding_rounds',
  }
);

class FundingRoundConsiderationVoteAllowedSMEGroups extends Model<FundingRoundConsiderationVoteAllowedSMEGroupsAttributes, FundingRoundConsiderationVoteAllowedSMEGroupsCreationAttributes> implements FundingRoundConsiderationVoteAllowedSMEGroupsAttributes {
  public id!: number;
  public fundingRoundId!: number;
  public smeGroupId!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

FundingRoundConsiderationVoteAllowedSMEGroups.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    fundingRoundId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: FundingRound,
        key: 'id',
      },
    },
    smeGroupId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: SMEGroup,
        key: 'id',
      },
    },
  },
  {
    sequelize,
    tableName: 'funding_round_consideration_vote_allowed_sme_groups',
    indexes: [
      {
        unique: true,
        fields: ['fundingRoundId', 'smeGroupId'],
      },
    ],
  }
);

class TopicSMEGroupProposalCreationLimiter extends Model<TopicSMEGroupProposalCreationLimiterAttributes, TopicSMEGroupProposalCreationLimiterCreationAttributes> implements TopicSMEGroupProposalCreationLimiterAttributes {
  public id!: number;
  public topicId!: number;
  public smeGroupId!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

TopicSMEGroupProposalCreationLimiter.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    topicId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Topic,
        key: 'id',
      },
    },
    smeGroupId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: SMEGroup,
        key: 'id',
      },
    },
  },
  {
    sequelize,
    tableName: 'topic_sme_group_proposal_creation_limiters',
    indexes: [
      {
        unique: true,
        fields: ['topicId', 'smeGroupId'],
      },
    ],
  }
);

class ConsiderationPhase extends Model<ConsiderationPhaseAttributes, ConsiderationPhaseCreationAttributes> implements ConsiderationPhaseAttributes {
  public id!: number;
  public fundingRoundId!: number;
  public startAt!: Date;
  public endAt!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ConsiderationPhase.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    fundingRoundId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: FundingRound,
        key: 'id',
      },
    },
    startAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'consideration_phases',
  }
);

class DeliberationPhase extends Model<DeliberationPhaseAttributes, DeliberationPhaseCreationAttributes> implements DeliberationPhaseAttributes {
  public id!: number;
  public fundingRoundId!: number;
  public startAt!: Date;
  public endAt!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

DeliberationPhase.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    fundingRoundId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: FundingRound,
        key: 'id',
      },
    },
    startAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'deliberation_phases',
  }
);

class FundingVotingPhase extends Model<FundingVotingPhaseAttributes, FundingVotingPhaseCreationAttributes> implements FundingVotingPhaseAttributes {
  public id!: number;
  public fundingRoundId!: number;
  public startAt!: Date;
  public endAt!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

FundingVotingPhase.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    fundingRoundId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: FundingRound,
        key: 'id',
      },
    },
    startAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'funding_voting_phases',
  }
);

class Proposal extends Model<ProposalAttributes, ProposalCreationAttributes> implements ProposalAttributes {
  public id!: number;
  public name!: string;
  public proposerDuid!: number;
  public budget!: number;
  public uri!: string;
  public fundingRoundId!: number | null;
  public status!: ProposalStatus;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Proposal.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    proposerDuid: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    budget: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    uri: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    fundingRoundId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: FundingRound,
        key: 'id',
      },
    },
    status: {
      type: DataTypes.ENUM(...Object.values(ProposalStatus)),
      allowNull: false,
      defaultValue: ProposalStatus.DRAFT,
    },
  },
  {
    sequelize,
    tableName: 'proposals',
  }
);

class FundingRoundDeliberationCommitteeSelection extends Model<FundingRoundDeliberationCommitteeSelectionAttributes, FundingRoundDeliberationCommitteeSelectionCreationAttributes> implements FundingRoundDeliberationCommitteeSelectionAttributes {
  public id!: number;
  public duid!: number;
  public fundingRoundId!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

FundingRoundDeliberationCommitteeSelection.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    duid: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    fundingRoundId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: FundingRound,
        key: 'id',
      },
    },
  },
  {
    sequelize,
    tableName: 'funding_round_deliberation_committee_selections',
    indexes: [
      {
        unique: true,
        fields: ['duid', 'fundingRoundId'],
      },
    ],
  }
);

class SMEConsiderationVoteLog extends Model<SMEConsiderationVoteLogAttributes, SMEConsiderationVoteLogCreationAttributes> implements SMEConsiderationVoteLogAttributes {
  public id!: number;
  public duid!: number;
  public proposalId!: number;
  public isPass!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SMEConsiderationVoteLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    duid: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    proposalId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Proposal,
        key: 'id',
      },
    },
    isPass: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'sme_consideration_vote_logs',
  }
);

class GPTSummarizerVoteLog extends Model<GPTSummarizerVoteLogAttributes, GPTSummarizerVoteLogCreationAttributes> implements GPTSummarizerVoteLogAttributes {
  public id!: number;
  public duid!: number;
  public proposalId!: number;
  public why!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

GPTSummarizerVoteLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    duid: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    proposalId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Proposal,
        key: 'id',
      },
    },
    why: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'gpt_summarizer_vote_logs',
  }
);

class CommitteeDeliberationVoteLog extends Model<CommitteeDeliberationVoteLogAttributes, CommitteeDeliberationVoteLogCreationAttributes> implements CommitteeDeliberationVoteLogAttributes {
  public id!: number;
  public duid!: number;
  public proposalId!: number;
  public vote!: CommitteeDeliberationVoteChoice;
  public uri!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

CommitteeDeliberationVoteLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    duid: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    proposalId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Proposal,
        key: 'id',
      },
    },
    vote: {
      type: DataTypes.ENUM(...Object.values(CommitteeDeliberationVoteChoice)),
      allowNull: false,
    },
    uri: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'committee_deliberation_vote_logs',
  }
);

class CommitteeDeliberationProjectSelection extends Model<CommitteeDeliberationProjectSelectionAttributes, CommitteeDeliberationProjectSelectionCreationAttributes> implements CommitteeDeliberationProjectSelectionAttributes {
  public id!: number;
  public proposalId!: number;
  public fundingRoundId!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

CommitteeDeliberationProjectSelection.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    proposalId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Proposal,
        key: 'id',
      },
    },
    fundingRoundId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: FundingRound,
        key: 'id',
      },
    },
  },
  {
    sequelize,
    tableName: 'committee_deliberation_project_selections',
    indexes: [
      {
        unique: true,
        fields: ['proposalId', 'fundingRoundId'],
      },
    ],
  }
);

class FundingRoundApprovalVote extends Model<FundingRoundApprovalVoteAttributes, FundingRoundApprovalVoteCreationAttributes> implements FundingRoundApprovalVoteAttributes {
  public id!: number;
  public duid!: number;
  public fundingRoundId!: number;
  public isPass!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

FundingRoundApprovalVote.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    duid: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    fundingRoundId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: FundingRound,
        key: 'id',
      },
    },
    isPass: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'funding_round_approval_votes',
  }
);

// Define associations
User.hasMany(UserPublicKey, { foreignKey: 'duid' });
UserPublicKey.belongsTo(User, { foreignKey: 'duid' });

SMEGroup.hasMany(SMEGroupMembership, { foreignKey: 'smeGroupId' });
SMEGroupMembership.belongsTo(SMEGroup, { foreignKey: 'smeGroupId' });

Topic.hasMany(TopicCommittee, { foreignKey: 'topicId' });
TopicCommittee.belongsTo(Topic, { foreignKey: 'topicId' });

SMEGroup.hasMany(TopicCommittee, { foreignKey: 'smeGroupId' });
TopicCommittee.belongsTo(SMEGroup, { foreignKey: 'smeGroupId' });

Topic.hasMany(FundingRound, { foreignKey: 'topicId' });
FundingRound.belongsTo(Topic, { foreignKey: 'topicId' });

FundingRound.hasMany(FundingRoundConsiderationVoteAllowedSMEGroups, { foreignKey: 'fundingRoundId' });
FundingRoundConsiderationVoteAllowedSMEGroups.belongsTo(FundingRound, { foreignKey: 'fundingRoundId' });

SMEGroup.hasMany(FundingRoundConsiderationVoteAllowedSMEGroups, { foreignKey: 'smeGroupId' });
FundingRoundConsiderationVoteAllowedSMEGroups.belongsTo(SMEGroup, { foreignKey: 'smeGroupId' });

Topic.hasMany(TopicSMEGroupProposalCreationLimiter, { foreignKey: 'topicId' });
TopicSMEGroupProposalCreationLimiter.belongsTo(Topic, { foreignKey: 'topicId' });

SMEGroup.hasMany(TopicSMEGroupProposalCreationLimiter, { foreignKey: 'smeGroupId' });
TopicSMEGroupProposalCreationLimiter.belongsTo(SMEGroup, { foreignKey: 'smeGroupId' });

FundingRound.hasOne(ConsiderationPhase, { foreignKey: 'fundingRoundId' });
ConsiderationPhase.belongsTo(FundingRound, { foreignKey: 'fundingRoundId' });

FundingRound.hasOne(DeliberationPhase, { foreignKey: 'fundingRoundId' });
DeliberationPhase.belongsTo(FundingRound, { foreignKey: 'fundingRoundId' });

FundingRound.hasOne(FundingVotingPhase, { foreignKey: 'fundingRoundId' });
FundingVotingPhase.belongsTo(FundingRound, { foreignKey: 'fundingRoundId' });

FundingRound.hasMany(Proposal, { foreignKey: 'fundingRoundId' });
Proposal.belongsTo(FundingRound, { foreignKey: 'fundingRoundId' });

FundingRound.hasMany(FundingRoundDeliberationCommitteeSelection, { foreignKey: 'fundingRoundId' });
FundingRoundDeliberationCommitteeSelection.belongsTo(FundingRound, { foreignKey: 'fundingRoundId' });

Proposal.hasMany(SMEConsiderationVoteLog, { foreignKey: 'proposalId' });
SMEConsiderationVoteLog.belongsTo(Proposal, { foreignKey: 'proposalId' });

Proposal.hasMany(GPTSummarizerVoteLog, { foreignKey: 'proposalId' });
GPTSummarizerVoteLog.belongsTo(Proposal, { foreignKey: 'proposalId' });

Proposal.hasMany(CommitteeDeliberationVoteLog, { foreignKey: 'proposalId' });
CommitteeDeliberationVoteLog.belongsTo(Proposal, { foreignKey: 'proposalId' });

Proposal.hasMany(CommitteeDeliberationProjectSelection, { foreignKey: 'proposalId' });
CommitteeDeliberationProjectSelection.belongsTo(Proposal, { foreignKey: 'proposalId' });

FundingRound.hasMany(CommitteeDeliberationProjectSelection, { foreignKey: 'fundingRoundId' });
CommitteeDeliberationProjectSelection.belongsTo(FundingRound, { foreignKey: 'fundingRoundId' });

FundingRound.hasMany(FundingRoundApprovalVote, { foreignKey: 'fundingRoundId' });
FundingRoundApprovalVote.belongsTo(FundingRound, { foreignKey: 'fundingRoundId' });

// Export models
export {
  User,
  SMEGroup,
  SMEGroupMembership,
  AdminUser,
  UserPublicKey,
  Topic,
  TopicCommittee,
  FundingRound,
  FundingRoundConsiderationVoteAllowedSMEGroups,
  TopicSMEGroupProposalCreationLimiter,
  ConsiderationPhase,
  DeliberationPhase,
  FundingVotingPhase,
  Proposal,
  FundingRoundDeliberationCommitteeSelection,
  SMEConsiderationVoteLog,
  GPTSummarizerVoteLog,
  CommitteeDeliberationVoteLog,
  CommitteeDeliberationProjectSelection,
  FundingRoundApprovalVote,
};

/**
 * Syncs all models with the database.
 */
export const syncDatabase = async (): Promise<void> => {
  try {
    await sequelize.sync();
    console.log('Database synced successfully');
  } catch (error) {
    console.error('Error syncing database:', error);
  }
};

// export the sequelize instance
export { sequelize };