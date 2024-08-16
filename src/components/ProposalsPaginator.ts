import { FundingRoundLogic } from "../channels/admin/screens/FundingRoundLogic";
import { TrackedInteraction } from "../core/BaseClasses";
import { ArgumentOracle } from "../CustomIDOracle";
import { ProposalLogic } from "../logic/ProposalLogic";
import { FundingRound, Proposal } from "../models";
import { ORMModelPaginator } from "./PaginationComponent";

export abstract class ProposalsPaginator extends ORMModelPaginator<Proposal> {
    public readonly description: string = 'To continue, select a Proposal from the list below';
    public readonly placeholder: string = 'Select a proposal';


    protected async getOptions(interaction: TrackedInteraction, items: Proposal[]): Promise<any> {
        return items.map((fr: Proposal) => ({
            label: fr.name,
            value: fr.id.toString(),
            description: `Budget: ${fr.budget}, Status: ${fr.status}`
        }));
    }

}

export class EditMySubmittedProposalsPaginator extends ProposalsPaginator {
    public static readonly ID = "EdMySuPP"
    public args: string[] = [];
    public title: string = "Edit A Submitted Proposal";

    public readonly REQUIRED_ARGUMENTS: string[] = [ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID, ];

    public async getItems(interaction: TrackedInteraction): Promise<Proposal[]> {
        const fundingRoundId: string = ArgumentOracle.getNamedArgument(interaction, ArgumentOracle.COMMON_ARGS.FUNDING_ROUND_ID);
        const fundingRoundIdNum: number = parseInt(fundingRoundId)
        const fundingRound: FundingRound = await FundingRoundLogic.getFundingRoundByIdOrError(fundingRoundIdNum);
        const proposals: Proposal[] = await ProposalLogic.getUserProposalsForFundingRound(interaction.interaction.user.id, fundingRoundIdNum);
        const eligibleProposals: Proposal[] = proposals.filter((p: Proposal) =>
            FundingRoundLogic.isProposalActiveForFundingRound(p, fundingRound)
        );
        return eligibleProposals;
    }



}