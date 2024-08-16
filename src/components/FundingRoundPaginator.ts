import { FundingRoundLogic } from "../channels/admin/screens/FundingRoundLogic";
import { TrackedInteraction } from "../core/BaseClasses";
import { FundingRound } from "../models";
import { ORMModelPaginator, PaginationComponent } from "./PaginationComponent";

/**
 * Reusable pagniator component for the selection of Funding Rounds. Invoke .showFundingRoundSelect() with
 * the action & operation to which the fundingRoundId selection shold be passed in the customId.
 */

export abstract class FundingRoundPaginator extends ORMModelPaginator<FundingRound> {
    public readonly description: string = 'To continue, select a Funding Round from the list below';
    public readonly placeholder: string = 'Select a Funding Round';


    public static BOOLEAN = {
        TRUE: 'yes',
        ARGUMENTS: {
            FORCE_REPLY: 'fRp'
        }
    }

    /**
     * Override this method to customize the list of Funding Rounds which should be presented/paginated.
     */
    public async getItems(interaction: TrackedInteraction): Promise<FundingRound[]> {
        return await FundingRoundLogic.getPresentAndFutureFundingRounds();
    } 

    protected async getOptions(interaction: TrackedInteraction, items: FundingRound[]): Promise<any> {
        return items.map((fr: FundingRound) => ({
            label: fr.name,
            value: fr.id.toString(),
            description: `Budget: ${fr.budget}, Status: ${fr.status}`
        }));
    }

}

export class EditFundingRoundPaginator extends FundingRoundPaginator {
    public static readonly ID = 'editFRPag';

    public args: string[] = []
    public title: string = "Select A Funding Round To Edit";
}

export class SetCommitteeFundingRoundPaginator extends FundingRoundPaginator {
    public args: string[] = [];
    public title: string = "Select A Funding Round To Set Committee For";
    public static readonly ID = 'setComFRPag';

    
}

export class RemoveCommiteeFundingRoundPaginator extends FundingRoundPaginator {
    public static readonly ID = 'remComFRPag';

    public args: string[] = [];
    public title: string = "Select A Funding Round To Remove Committee From";
}

export class ApproveRejectFundingRoundPaginator extends FundingRoundPaginator {
    public static readonly ID = 'appRejFRPag';

    public args: string[] = [];
    public title: string = "Select A Funding Round To Approve Or Reject";

    
}

export class InVotingFundingRoundPaginator extends FundingRoundPaginator {
    public static readonly ID = 'inVotFRPag';
    public args: string[] = [ORMModelPaginator.BOOLEAN.ARGUMENTS.FORCE_REPLY, ORMModelPaginator.BOOLEAN.TRUE]
    public title: string = "Select A Funding Round To Vote For";


    public async getItems(interaction: TrackedInteraction): Promise<FundingRound[]> {
        return await FundingRoundLogic.getEligibleVotingRounds();
    }
}