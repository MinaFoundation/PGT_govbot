export class OCVLinkGenerator {
    private static BASE_URL = 'https://example.com/vote'; // Replace with actual voting page URL
  
    static generateFundingRoundVoteLink(fundingRoundId: number): string {
      return `${this.BASE_URL}/funding-round?id=${fundingRoundId}&action=vote`;
    }
  
    static generateFundingRoundUnvoteLink(fundingRoundId: number): string {
      return `${this.BASE_URL}/funding-round?id=${fundingRoundId}&action=unvote`;
    }
  
    static generateProjectVoteLink(projectId: number, phase: string): string {
      return `${this.BASE_URL}/project?id=${projectId}&phase=${phase.toLowerCase()}`;
    }
  }