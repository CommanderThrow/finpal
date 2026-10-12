export type GoalKind = 'emergency_fund' | 'investing';

export interface Goal {
  id: string;
  kind: GoalKind;
  name: string;
  /** Target balance for the emergency fund; investing goals have no target. */
  targetAmount: number | null;
  monthlyContribution: number;
  savedAmount: number;
  currency: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  postedDate: string;
  amount: number;
  currency: string;
  description: string;
  merchantName: string | null;
  category: string | null;
  isPending: boolean;
}
