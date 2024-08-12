

export type FundingRoundMIPhase = {
    CONSIDERATION: 'consideration',
    DELIBERATION: 'deliberation',
    VOTING: 'voting',
    ROUND: 'round',
}

export type FundingRoundMIPhaseValue = FundingRoundMIPhase[keyof FundingRoundMIPhase]
/**
 * FundingRoundModelInterface - interface for the ORM operations on the FundingRound model.
 */
export class FundingRoundMI {

    static PHASES: FundingRoundMIPhase = {
        CONSIDERATION: 'consideration',
        DELIBERATION: 'deliberation',
        VOTING: 'voting',
        ROUND: 'round',
    }
    static toFundingRoundPhaseFromString(stringPhase: string): FundingRoundMIPhaseValue {
        switch (stringPhase) {
            case 'consideration':
                return FundingRoundMI.PHASES.CONSIDERATION
            case 'deliberation':
                return FundingRoundMI.PHASES.DELIBERATION;
            case 'voting':
                return FundingRoundMI.PHASES.VOTING;
            case 'round':
                return FundingRoundMI.PHASES.ROUND;
            default:
                throw new Error(`Invalid phase: ${stringPhase}. Must be one of 'consideration', 'deliberation', 'voting' or 'round'.`);
        }
    }
}